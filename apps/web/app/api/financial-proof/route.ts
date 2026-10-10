import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const revenue = Number(body.revenue);
    const threshold = Number(body.threshold);

    if (!Number.isSafeInteger(revenue) || revenue < 0) {
      return NextResponse.json(
        { error: "Invalid revenue" },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(threshold) || threshold < 0) {
      return NextResponse.json(
        { error: "Invalid threshold" },
        { status: 400 }
      );
    }

    if (revenue < threshold) {
      return NextResponse.json({
        valid: false,
        claim: "MIN_REVENUE",
        threshold,
        message:
          "Revenue does not satisfy the requested threshold.",
      });
    }

    console.error(
      "Financial proof generation is unavailable in this deployment: " +
      "the current prover requires Windows PowerShell and WSL."
    );

    return NextResponse.json(
      {
        valid: false,
        error:
          "Proof generation is unavailable on this deployment. " +
          "The current prover requires Windows PowerShell and WSL.",
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("Financial proof API request failed:", error);

    return NextResponse.json(
      {
        valid: false,
        error: "Invalid request or financial proof API failure.",
      },
      { status: 500 }
    );
  }
}