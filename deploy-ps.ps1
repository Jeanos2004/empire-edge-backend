# deploy-ps.ps1 — Deploiement via Supabase Management API (aucune CLI requise)

param(
    [string[]]$Functions = @()
)

$TOKEN       = $env:SUPABASE_ACCESS_TOKEN
if (-not $TOKEN) {
    Write-Host "ERROR: SUPABASE_ACCESS_TOKEN environment variable is not set." -ForegroundColor Red
    Write-Host "Set it with: `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'" -ForegroundColor Yellow
    exit 1
}
$PROJECT_REF = "qjfygjtondljywhbqbfj"
$API_BASE    = "https://api.supabase.com/v1/projects/$PROJECT_REF/functions"

$HEADERS = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type"  = "application/json"
}

# Couleurs
function Write-OK   { param($msg) Write-Host "OK  $msg" -ForegroundColor Green }
function Write-FAIL { param($msg) Write-Host "ERR $msg" -ForegroundColor Red }
function Write-INFO { param($msg) Write-Host "... $msg" -ForegroundColor Cyan }

function Deploy-Function {
    param([string]$RelPath)   # ex: "quotes/submit-request"

    $srcFile = "supabase\functions\$($RelPath -replace '/', '\')\index.ts"
    if (-not (Test-Path $srcFile)) {
        Write-FAIL "Fichier introuvable: $srcFile"
        return $false
    }

    # Le slug = derniere partie du chemin  (submit-request, get-all-quotes, etc.)
    $slug = ($RelPath -split "/")[-1]
    # Nom lisible
    $name = $RelPath

    Write-INFO "Deploiement de $RelPath (slug: $slug)..."

    $body_text = Get-Content $srcFile -Raw -Encoding UTF8

    $payload = @{
        slug       = $slug
        name       = $name
        body       = $body_text
        verify_jwt = $false
    } | ConvertTo-Json -Depth 5

    # Tenter PATCH (mise a jour) d'abord, puis POST (creation)
    try {
        $resp = Invoke-RestMethod -Uri "$API_BASE/$slug" `
                                  -Method Patch `
                                  -Headers $HEADERS `
                                  -Body $payload `
                                  -ErrorAction Stop
        Write-OK "$RelPath deploye (mise a jour)"
        return $true
    } catch {
        # Si 404 => la fonction n'existe pas encore => POST
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode -eq 404) {
            try {
                $resp = Invoke-RestMethod -Uri $API_BASE `
                                          -Method Post `
                                          -Headers $HEADERS `
                                          -Body $payload `
                                          -ErrorAction Stop
                Write-OK "$RelPath deploye (creation)"
                return $true
            } catch {
                Write-FAIL "$RelPath -- $($_.Exception.Message)"
                return $false
            }
        } else {
            Write-FAIL "$RelPath -- $($_.Exception.Message)"
            return $false
        }
    }
}

# Liste des fonctions a deployer
$all = @(
    "quotes/submit-request",
    "admin/get-all-quotes",
    "quotes/accept-quote",
    "quotes/reject-quote"
)

# Si des fonctions sont passees en parametre, on n'en deploie que celles-la
if ($Functions.Count -gt 0) { $all = $Functions }

Write-Host "`n=== Deploiement Empire Edge Functions ===" -ForegroundColor Blue
$ok = 0; $fail = 0

foreach ($f in $all) {
    if (Deploy-Function $f) { $ok++ } else { $fail++ }
}

Write-Host "`n=========================================" -ForegroundColor Blue
Write-Host "Succes : $ok   Echecs : $fail" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
Write-Host "=========================================`n" -ForegroundColor Blue
