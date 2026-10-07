import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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

    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "C:\\Users\\kashy\\credent\\scripts\\prove-financial-proof.ps1",
        "-Revenue",
        String(revenue),
        "-Threshold",
        String(threshold),
      ],
      {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    // The prover prints logs first and the JSON result last.
    const lines = stdout.trim().split(/\r?\n/);
    const jsonLine = lines[lines.length - 1];

    const proofResult = JSON.parse(jsonLine);

    return NextResponse.json({
      valid: proofResult.valid,
      claim: proofResult.claim,
      threshold: proofResult.threshold,
      proof: proofResult.proof,
      publicInputs: proofResult.publicInputs,
      verificationKey: proofResult.verificationKey,
    });
  } catch (error) {
    console.error("Financial proof generation failed:", error);

    return NextResponse.json(
      {
        valid: false,
        error: "Failed to generate financial proof.",
      },
      { status: 500 }
    );
  }
}