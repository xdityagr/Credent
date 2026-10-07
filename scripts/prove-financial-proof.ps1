param(
    [Parameter(Mandatory = $true)]
    [UInt64]$Revenue,

    [Parameter(Mandatory = $true)]
    [UInt64]$Threshold
)

$ErrorActionPreference = "Stop"

# Always resolve paths relative to this script's location.
$projectRoot = Split-Path -Parent $PSScriptRoot

$proverTomlPath = Join-Path `
    $projectRoot `
    "circuits\financial_proof\Prover.toml"

$projectPath = "/mnt/c/Users/kashy/credent/circuits/financial_proof"

$proverToml = @"
revenue = "$Revenue"
threshold = "$Threshold"
"@

$proverToml | Set-Content $proverTomlPath

# Generate the Noir witness.
wsl bash -lc "cd $projectPath && /home/kashyapaadi/.nargo/bin/nargo execute"

# Generate the ZK proof.
wsl bash -lc "cd $projectPath && rm -rf target/proof && /home/kashyapaadi/.bb/bb prove -b ./target/financial_proof.json -w ./target/financial_proof.gz --write_vk -o target/proof"

# Verify the proof.
wsl bash -lc "cd $projectPath && /home/kashyapaadi/.bb/bb verify -p target/proof/proof -i target/proof/public_inputs -k target/proof/vk"

# Return the generated proof artifacts as JSON.
$proof = wsl bash -lc "base64 -w 0 $projectPath/target/proof/proof"
$publicInputs = wsl bash -lc "base64 -w 0 $projectPath/target/proof/public_inputs"
$verificationKey = wsl bash -lc "base64 -w 0 $projectPath/target/proof/vk"

$result = @{
    valid = $true
    claim = "MIN_REVENUE"
    threshold = $Threshold
    proof = $proof.Trim()
    publicInputs = $publicInputs.Trim()
    verificationKey = $verificationKey.Trim()
}

$result | ConvertTo-Json -Compress