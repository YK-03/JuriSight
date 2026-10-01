import type {
  AuthorityRetrievalQuery,
  VerifiedAuthorityCandidate,
  VerifiedAuthoritySource,
} from "./authority-retrieval";

const ECOURTSINDIA_API_BASE = "https://webapi.ecourtsindia.com";
const MAX_SEARCH_RESULTS = 1;
const MAX_PASSAGE_LENGTH = 4000;

type FetchLike = typeof fetch;

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find(nonEmptyString)?.trim();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(nonEmptyString).map((item) => item.trim()) : [];
}

function documentedOrderUrl(cnr: string, filename: unknown): string | undefined {
  if (!nonEmptyString(filename)) return undefined;
  return `${ECOURTSINDIA_API_BASE}/api/partner/case/${encodeURIComponent(cnr)}/order/${encodeURIComponent(filename)}`;
}

function displayCaseName(record: Record<string, unknown>, caseData: Record<string, unknown>): string | undefined {
  const petitioners = stringArray(record.petitioners ?? caseData.petitioners);
  const respondents = stringArray(record.respondents ?? caseData.respondents);
  if (petitioners.length === 0 || respondents.length === 0) return undefined;
  return `${petitioners.join(", ")} v ${respondents.join(", ")}`;
}

function sourceText(data: Record<string, unknown>, caseData: Record<string, unknown>): string | undefined {
  const containers = [data.files, caseData.files].flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const files = (value as Record<string, unknown>).files;
      return Array.isArray(files) ? files : [];
    }
    return [];
  });
  const text = containers
    .map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).markdownContent : undefined)
    .find(nonEmptyString);
  return text?.trim().slice(0, MAX_PASSAGE_LENGTH);
}

function mapVerifiedCandidate(
  searchRecord: Record<string, unknown>,
  data: Record<string, unknown>,
): VerifiedAuthorityCandidate | undefined {
  const caseData = data.courtCaseData && typeof data.courtCaseData === "object"
    ? data.courtCaseData as Record<string, unknown>
    : {};
  const caseName = displayCaseName(searchRecord, caseData);
  const authorityId = firstString(caseData.cnr, searchRecord.cnr);
  const court = firstString(caseData.courtName, searchRecord.courtName);
  const date = firstString(caseData.decisionDate, caseData.judgmentDate, searchRecord.decisionDate);
  const orders = [caseData.judgmentOrders, caseData.interimOrders]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"));
  const order = orders[0] ?? {};
  const authorityDate = date ?? firstString(order.orderDate, order.judgmentDate);
  const judgmentUrl = documentedOrderUrl(authorityId || "", order.orderUrl);
  const relevantPassage = sourceText(data, caseData);

  // This is the documented authenticated provider endpoint, not a public direct PDF URL.
  if (!caseName || !authorityId || !court || !authorityDate || !judgmentUrl || !relevantPassage) {
    return undefined;
  }

  return {
    authorityId,
    caseName,
    court,
    officialIdentifier: authorityId,
    date: authorityDate,
    source: "eCourtsIndia",
    judgmentUrl,
    relevantPassage,
  };
}

export class EcourtsIndiaAuthorityProvider implements VerifiedAuthoritySource {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async retrieve(query: AuthorityRetrievalQuery): Promise<unknown[]> {
    const apiKey = process.env.ECOURTSINDIA_API_KEY?.trim();
    if (!apiKey || !query.queryText.trim()) return [];

    const searchUrl = new URL(`${ECOURTSINDIA_API_BASE}/api/partner/search`);
    searchUrl.searchParams.set("query", query.queryText.slice(0, 240));
    searchUrl.searchParams.set("pageSize", String(MAX_SEARCH_RESULTS));

    const searchResponse = await this.requestJson(searchUrl, apiKey);
    const searchData = searchResponse.data && typeof searchResponse.data === "object"
      ? searchResponse.data as Record<string, unknown>
      : {};
    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const firstResult = results[0];
    if (!firstResult || typeof firstResult !== "object") return [];

    const searchRecord = firstResult as Record<string, unknown>;
    const cnr = firstString(searchRecord.cnr);
    if (!cnr) return [];

    const detailUrl = new URL(`${ECOURTSINDIA_API_BASE}/api/partner/case/${encodeURIComponent(cnr)}`);
    const detailResponse = await this.requestJson(detailUrl, apiKey);
    const detailData = detailResponse.data && typeof detailResponse.data === "object"
      ? detailResponse.data as Record<string, unknown>
      : {};
    const candidate = mapVerifiedCandidate(searchRecord, detailData);
    return candidate ? [candidate] : [];
  }

  private async requestJson(url: URL, apiKey: string): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`eCourtsIndia request failed with status ${response.status}`);
    const body: unknown = await response.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : {};
  }
}

export const ecourtsIndiaAuthorityProvider = new EcourtsIndiaAuthorityProvider();
