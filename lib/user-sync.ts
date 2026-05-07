import { auth, currentUser } from "@clerk/nextjs/server";
import db from "./db";

export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      const clerkUser = await currentUser();
      if (!clerkUser) return null;

      user = await db.user.create({
        data: {
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null,
          image: clerkUser.imageUrl,
        },
      });
    }

    return user;
  } catch (error) {
    console.error("[DB ERROR] getOrCreateUser failed:", error);
    return null;
  }
}
