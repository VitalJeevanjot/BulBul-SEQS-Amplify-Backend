const hmrcBusinessDetailsApiVersion = "application/vnd.hmrc.2.0+json";

const requiredEnvironmentVariable = (name: string): string => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
};

const ninoRegex = /^((?!(BG|GB|KN|NK|NT|TN|ZZ)|(D|F|I|Q|U|V)[A-Z]|[A-Z](D|F|I|O|Q|U|V))[A-Z]{2})[0-9]{6}[A-D]$/;
const businessIdRegex = /^X[A-Z0-9]{1}IS[0-9]{11}$/;

export const assertValidNino = (nino: string): void => {
    if (!ninoRegex.test(nino)) {
        throw new Error("The provided NINO is invalid");
    }
};

export const assertValidBusinessId = (businessId: string): void => {
    if (!businessIdRegex.test(businessId)) {
        throw new Error("The provided Business ID is invalid");
    }
};

const parseFraudPreventionHeaders = (
    fraudPreventionHeaders?: string | null,
): Record<string, string> => {
    if (!fraudPreventionHeaders) {
        return {};
    }

    const parsed = JSON.parse(fraudPreventionHeaders) as unknown;

    if (
        !parsed
        || typeof parsed !== "object"
        || Array.isArray(parsed)
    ) {
        throw new Error("Fraud prevention headers must be a JSON object");
    }

    return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => {
            if (typeof value !== "string") {
                throw new Error("Fraud prevention header values must be strings");
            }

            return [key, value];
        }),
    );
};

type HmrcBusinessDetailsRequest = {
    accessToken: string;
    path: string;
    govTestScenario?: string | null;
    fraudPreventionHeaders?: string | null;
};

export const requestHmrcBusinessDetails = async ({
    accessToken,
    path,
    govTestScenario,
    fraudPreventionHeaders,
}: HmrcBusinessDetailsRequest): Promise<string> => {
    const headers: Record<string, string> = {
        accept: hmrcBusinessDetailsApiVersion,
        authorization: `Bearer ${accessToken}`,
        ...parseFraudPreventionHeaders(fraudPreventionHeaders),
    };

    if (govTestScenario) {
        headers["Gov-Test-Scenario"] = govTestScenario;
    }

    const baseUrl = requiredEnvironmentVariable("HMRC_API_BASE_URL");
    const response = await fetch(new URL(path, baseUrl), {
        method: "GET",
        headers,
    });
    const responseBody = await response.text();

    if (!response.ok) {
        throw new Error(
            `HMRC business details request failed (${response.status}): ${responseBody}`,
        );
    }

    return responseBody;
};
