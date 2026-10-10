import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          valid: false,
          error:
            "Online proof generation is unavailable. " +
            "The current prover requires Windows PowerShell and WSL.",
        },
        { status: 503 }
      );
    }

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

    const projectRoot = process.cwd().endsWith("\\apps\\web")
      ? process.cwd().slice(0, -9)
      : "C:\\Users\\kashy\\credent";

    const scriptPath =
      projectRoot + "\\scripts\\prove-financial-proof.ps1";

    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
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

    const lines = stdout.trim().split(/\r?\n/);
    const proofResult = JSON.parse(lines[lines.length - 1]);

    if (
      !proofResult.valid ||
      typeof proofResult.proof !== "string" ||
      typeof proofResult.publicInputs !== "string" ||
      typeof proofResult.verificationKey !== "string"
    ) {
      throw new Error("The prover returned incomplete proof artifacts.");
    }

    return NextResponse.json({
      valid: true,
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
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate financial proof.",
      },
      { status: 500 }
    );
  }
}