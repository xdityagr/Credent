import { NextResponse } from "next/server";

import {
  createBusinessCreditProofCredential,
} from "../../../lib/mockCredential";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const subjectId =
      typeof body.subjectId === "string" && body.subjectId.length > 0
        ? body.subjectId
        : "did:credent:demo-business";

    const credential =
      await createBusinessCreditProofCredential(subjectId);

    return NextResponse.json({
      success: true,
      credential,
    });
  } catch (error) {
    console.error(
      "Business credential generation failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate business credential.",
      },
      { status: 500 }
    );
  }
}
