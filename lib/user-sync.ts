import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import db from "./db";

function isP2002(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002";
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) return null;

  let email: string | null = null;

  try {
    // 1. Existing users are found by clerkId first.
    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (user) {
      return user;
    }

    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    email =
      clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses?.[0]?.emailAddress ??
      null;
    const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null;
    const image = clerkUser.imageUrl || null;

    // 2. If no clerkId match exists but the Clerk email belongs to an existing User,
    // safely reconcile with that existing User instead of creating a duplicate.
    if (email) {
      const existingUserByEmail = await db.user.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
        user = await db.user.update({
          where: { id: existingUserByEmail.id },
          data: {
            clerkId: userId,
            ...(name && !existingUserByEmail.name ? { name } : {}),
            ...(image && !existingUserByEmail.image ? { image } : {}),
          },
        });
        return user;
      }
    }

    // 3. Otherwise create the User.
    user = await db.user.create({
      data: {
        clerkId: userId,
        email,
        name,
        image,
      },
    });

    return user;
  } catch (error) {
    // 4. Concurrent requests cannot leave the function failing with an avoidable P2002.
    // If a narrow P2002 race occurs, re-read the conflicting user and return/reconcile it.
    if (isP2002(error)) {
      try {
        const existingByClerk = await db.user.findUnique({
          where: { clerkId: userId },
        });
        if (existingByClerk) {
          return existingByClerk;
        }

        if (email) {
          const existingByEmail = await db.user.findUnique({
            where: { email },
          });
          if (existingByEmail) {
            return await db.user.update({
              where: { id: existingByEmail.id },
              data: { clerkId: userId },
            });
          }
        }
      } catch (raceError) {
        if (isP2002(raceError)) {
          const fallbackUser = await db.user.findUnique({
            where: { clerkId: userId },
          });
          if (fallbackUser) {
            return fallbackUser;
          }
        }
        console.error("[DB ERROR] getOrCreateUser race resolution failed:", raceError);
        return null;
      }
    }

    console.error("[DB ERROR] getOrCreateUser failed:", error);
    return null;
  }
}
