
param(
    [Parameter(Mandatory = $true)]
    [UInt64]$Revenue,

    [Parameter(Mandatory = $true)]
    [UInt64]$Threshold
)

$ErrorActionPreference = "Stop"

# Demo-only inputs: these match the commitment
# generated and verified for our current mock revenue.
$DemoRevenue = [UInt64]2500000
$Nonce = "12345"
$ExpectedCommitment = "0x1c466dbf98a6d9a9097c4f83ecb072d0dcfc4052e75dfdeab7b7fec1c8d3b3cc"

if ($Revenue -ne $DemoRevenue) {
    throw "This demo commitment is bound to revenue 2500000."
}

if ($Threshold -gt $Revenue) {
    throw "Revenue does not meet the requested threshold."
}

$projectRoot = Split-Path -Parent $PSScriptRoot

$proverTomlPath = Join-Path `
    $projectRoot `
    "circuits\financial_proof\Prover.toml"

$projectPath = "/mnt/c/Users/kashy/credent/circuits/financial_proof"

$proverToml = @"
revenue = "$Revenue"
nonce = "$Nonce"
threshold = "$Threshold"
expected_commitment = "$ExpectedCommitment"
"@

$proverToml | Set-Content $proverTomlPath

# Generate the Noir witness.
wsl bash -lc "cd $projectPath && /home/kashyapaadi/.nargo/bin/nargo execute"
if ($LASTEXITCODE -ne 0) {
    throw "Noir witness generation failed."
}

# Generate the ZK proof.
wsl bash -lc "cd $projectPath && rm -rf target/proof && /home/kashyapaadi/.bb/bb prove -b ./target/financial_proof.json -w ./target/financial_proof.gz --write_vk -o target/proof"
if ($LASTEXITCODE -ne 0) {
    throw "ZK proof generation failed."
}

# Verify the proof.
wsl bash -lc "cd $projectPath && /home/kashyapaadi/.bb/bb verify -p target/proof/proof -i target/proof/public_inputs -k target/proof/vk"
if ($LASTEXITCODE -ne 0) {
    throw "ZK proof verification failed."
}

# Return the proof artifacts.
$proof = wsl bash -lc "base64 -w 0 $projectPath/target/proof/proof"
$publicInputs = wsl bash -lc "base64 -w 0 $projectPath/target/proof/public_inputs"
$verificationKey = wsl bash -lc "base64 -w 0 $projectPath/target/proof/vk"

if ($LASTEXITCODE -ne 0) {
    throw "Failed to read proof artifacts."
}

$result = @{
    valid = $true
    claim = "MIN_REVENUE"
    threshold = $Threshold
    proof = ($proof -join "").Trim()
    publicInputs = ($publicInputs -join "").Trim()
    verificationKey = ($verificationKey -join "").Trim()
}

$result | ConvertTo-Json -Compress
