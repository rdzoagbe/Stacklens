<#
.SYNOPSIS
    Creates 15 SaaS Enterprise Applications in Entra ID and assigns Nexus Technologies
    test users to each app, mirroring the stacklens-db.json access records.

.DESCRIPTION
    - Creates one non-gallery Enterprise App per SaaS tool
    - Enables "Assignment required" so only assigned users appear in Stacklens
    - Assigns users exactly as defined in the test dataset
    - Safe to re-run: skips apps and assignments that already exist

.PREREQUISITES
    Install-Module Microsoft.Graph -Scope CurrentUser
    (PowerShell 7+ recommended)

.USAGE
    .\Assign-NexusApps.ps1 -TenantDomain "rolanddzoagbehotmail.onmicrosoft.com"

    Add -WhatIf to preview without making changes.
    Add -Verbose for detailed output.
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [string]$TenantDomain,

    [switch]$RemoveAll   # Use to undo: removes all apps created by this script
)

#region -- Config ------------------------------------------------------------

# SaaS tools - matches stacklens-db.json tool IDs
$Tools = @(
    @{ Id = "tool-001"; Name = "GitHub Enterprise";             Category = "Development";        Website = "https://github.com" }
    @{ Id = "tool-002"; Name = "Slack Pro";                     Category = "Communication";      Website = "https://slack.com" }
    @{ Id = "tool-003"; Name = "Notion Team";                   Category = "Productivity";       Website = "https://notion.so" }
    @{ Id = "tool-004"; Name = "Jira Software";                 Category = "Project Management"; Website = "https://atlassian.com/jira" }
    @{ Id = "tool-005"; Name = "Figma Professional";            Category = "Design";             Website = "https://figma.com" }
    @{ Id = "tool-006"; Name = "Salesforce Sales Cloud";        Category = "CRM";                Website = "https://salesforce.com" }
    @{ Id = "tool-007"; Name = "HubSpot Marketing Hub";         Category = "Marketing";          Website = "https://hubspot.com" }
    @{ Id = "tool-008"; Name = "Zoom Business";                 Category = "Communication";      Website = "https://zoom.us" }
    @{ Id = "tool-009"; Name = "1Password Teams";               Category = "Security";           Website = "https://1password.com" }
    @{ Id = "tool-010"; Name = "Miro Team";                     Category = "Productivity";       Website = "https://miro.com" }
    @{ Id = "tool-011"; Name = "DocuSign Standard";             Category = "Legal";              Website = "https://docusign.com" }
    @{ Id = "tool-012"; Name = "Loom Business";                 Category = "Communication";      Website = "https://loom.com" }
    @{ Id = "tool-013"; Name = "Intercom Starter";              Category = "Customer Success";   Website = "https://intercom.com" }
    @{ Id = "tool-014"; Name = "Google Workspace Business Plus"; Category = "Productivity";      Website = "https://workspace.google.com" }
    @{ Id = "tool-015"; Name = "Datadog Pro";                   Category = "Monitoring";         Website = "https://datadoghq.com" }
)

# Users - first.last prefix maps to @$TenantDomain UPN
$Users = @(
    @{ Id = "emp-001"; Prefix = "alice.martin" }
    @{ Id = "emp-002"; Prefix = "bob.chen" }
    @{ Id = "emp-003"; Prefix = "claire.dubois" }
    @{ Id = "emp-004"; Prefix = "david.nguyen" }
    @{ Id = "emp-005"; Prefix = "emma.leroy" }
    @{ Id = "emp-006"; Prefix = "francois.bernard" }
    @{ Id = "emp-007"; Prefix = "grace.smith" }
    @{ Id = "emp-008"; Prefix = "hugo.petit" }
    @{ Id = "emp-009"; Prefix = "isabelle.moreau" }
    @{ Id = "emp-010"; Prefix = "julien.garcia" }
    @{ Id = "emp-011"; Prefix = "karen.wilson" }
    @{ Id = "emp-012"; Prefix = "lucas.thomas" }
    @{ Id = "emp-013"; Prefix = "marie.robert" }
    @{ Id = "emp-014"; Prefix = "nicolas.laurent" }
    @{ Id = "emp-015"; Prefix = "olivia.simon" }
)

# Access records - matches stacklens-db.json access array exactly
$AccessRecords = @(
    # Alice Martin (emp-001)
    @{ EmpId = "emp-001"; ToolId = "tool-001"; Role = "Admin" }
    @{ EmpId = "emp-001"; ToolId = "tool-002"; Role = "Admin" }
    @{ EmpId = "emp-001"; ToolId = "tool-003"; Role = "Member" }
    @{ EmpId = "emp-001"; ToolId = "tool-004"; Role = "Admin" }
    @{ EmpId = "emp-001"; ToolId = "tool-009"; Role = "Admin" }
    @{ EmpId = "emp-001"; ToolId = "tool-014"; Role = "Admin" }
    # Bob Chen (emp-002)
    @{ EmpId = "emp-002"; ToolId = "tool-001"; Role = "Member" }
    @{ EmpId = "emp-002"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-002"; ToolId = "tool-003"; Role = "Member" }
    @{ EmpId = "emp-002"; ToolId = "tool-004"; Role = "Member" }
    @{ EmpId = "emp-002"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-002"; ToolId = "tool-014"; Role = "Member" }
    # Claire Dubois (emp-003)
    @{ EmpId = "emp-003"; ToolId = "tool-001"; Role = "Member" }
    @{ EmpId = "emp-003"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-003"; ToolId = "tool-004"; Role = "Member" }
    @{ EmpId = "emp-003"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-003"; ToolId = "tool-012"; Role = "Member" }
    @{ EmpId = "emp-003"; ToolId = "tool-014"; Role = "Member" }
    # David Nguyen (emp-004)
    @{ EmpId = "emp-004"; ToolId = "tool-001"; Role = "Member" }
    @{ EmpId = "emp-004"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-004"; ToolId = "tool-005"; Role = "Viewer" }
    @{ EmpId = "emp-004"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-004"; ToolId = "tool-010"; Role = "Member" }
    @{ EmpId = "emp-004"; ToolId = "tool-014"; Role = "Member" }
    # Emma Leroy (emp-005)
    @{ EmpId = "emp-005"; ToolId = "tool-001"; Role = "Member" }
    @{ EmpId = "emp-005"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-005"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-005"; ToolId = "tool-014"; Role = "Member" }
    @{ EmpId = "emp-005"; ToolId = "tool-015"; Role = "Admin" }
    # Francois Bernard (emp-006)
    @{ EmpId = "emp-006"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-006"; ToolId = "tool-003"; Role = "Admin" }
    @{ EmpId = "emp-006"; ToolId = "tool-007"; Role = "Admin" }
    @{ EmpId = "emp-006"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-006"; ToolId = "tool-012"; Role = "Admin" }
    @{ EmpId = "emp-006"; ToolId = "tool-014"; Role = "Member" }
    # Grace Smith (emp-007)
    @{ EmpId = "emp-007"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-007"; ToolId = "tool-003"; Role = "Member" }
    @{ EmpId = "emp-007"; ToolId = "tool-007"; Role = "Member" }
    @{ EmpId = "emp-007"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-007"; ToolId = "tool-014"; Role = "Member" }
    # Hugo Petit (emp-008)
    @{ EmpId = "emp-008"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-008"; ToolId = "tool-003"; Role = "Member" }
    @{ EmpId = "emp-008"; ToolId = "tool-005"; Role = "Admin" }
    @{ EmpId = "emp-008"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-008"; ToolId = "tool-010"; Role = "Admin" }
    @{ EmpId = "emp-008"; ToolId = "tool-014"; Role = "Member" }
    # Isabelle Moreau (emp-009)
    @{ EmpId = "emp-009"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-009"; ToolId = "tool-006"; Role = "Admin" }
    @{ EmpId = "emp-009"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-009"; ToolId = "tool-011"; Role = "Member" }
    @{ EmpId = "emp-009"; ToolId = "tool-013"; Role = "Admin" }
    @{ EmpId = "emp-009"; ToolId = "tool-014"; Role = "Member" }
    # Julien Garcia (emp-010)
    @{ EmpId = "emp-010"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-010"; ToolId = "tool-006"; Role = "Member" }
    @{ EmpId = "emp-010"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-010"; ToolId = "tool-011"; Role = "Member" }
    @{ EmpId = "emp-010"; ToolId = "tool-014"; Role = "Member" }
    # Karen Wilson (emp-011)
    @{ EmpId = "emp-011"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-011"; ToolId = "tool-006"; Role = "Member" }
    @{ EmpId = "emp-011"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-011"; ToolId = "tool-014"; Role = "Member" }
    # Lucas Thomas (emp-012)
    @{ EmpId = "emp-012"; ToolId = "tool-002"; Role = "Admin" }
    @{ EmpId = "emp-012"; ToolId = "tool-003"; Role = "Member" }
    @{ EmpId = "emp-012"; ToolId = "tool-008"; Role = "Admin" }
    @{ EmpId = "emp-012"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-012"; ToolId = "tool-014"; Role = "Admin" }
    # Marie Robert (emp-013)
    @{ EmpId = "emp-013"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-013"; ToolId = "tool-003"; Role = "Member" }
    @{ EmpId = "emp-013"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-013"; ToolId = "tool-014"; Role = "Member" }
    # Nicolas Laurent (emp-014)
    @{ EmpId = "emp-014"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-014"; ToolId = "tool-003"; Role = "Member" }
    @{ EmpId = "emp-014"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-014"; ToolId = "tool-011"; Role = "Admin" }
    @{ EmpId = "emp-014"; ToolId = "tool-014"; Role = "Member" }
    # Olivia Simon (emp-015)
    @{ EmpId = "emp-015"; ToolId = "tool-002"; Role = "Member" }
    @{ EmpId = "emp-015"; ToolId = "tool-009"; Role = "Member" }
    @{ EmpId = "emp-015"; ToolId = "tool-014"; Role = "Member" }
)

# Tag added to every app's Notes so we can find/remove them later
$ScriptTag = "Stacklens-TestData"

#endregion

#region -- Connect -----------------------------------------------------------

Write-Host "`n=== Stacklens Test Data - Entra ID App Provisioner ===" -ForegroundColor Cyan
Write-Host "Tenant: $TenantDomain`n"

$RequiredScopes = @(
    "Application.ReadWrite.All"
    "AppRoleAssignment.ReadWrite.All"
    "User.Read.All"
)

try {
    $ctx = Get-MgContext -ErrorAction SilentlyContinue
    if (-not $ctx) {
        Write-Host "Connecting to Microsoft Graph..." -ForegroundColor Yellow
        Connect-MgGraph -Scopes $RequiredScopes -NoWelcome
    } else {
        Write-Verbose "Already connected as $($ctx.Account)"
    }
} catch {
    Write-Error "Failed to connect: $_"
    exit 1
}

#endregion

#region -- Remove mode -------------------------------------------------------

if ($RemoveAll) {
    Write-Host "`n[REMOVE MODE] Searching for apps tagged '$ScriptTag'..." -ForegroundColor Yellow
    $apps = Get-MgApplication -All -Filter "startswith(displayName,'GitHub Enterprise') or startswith(displayName,'Slack Pro')" `
        -ErrorAction SilentlyContinue

    # Fallback: list all and filter by tag in notes
    $allApps = Get-MgApplication -All
    $taggedApps = $allApps | Where-Object { $_.Notes -like "*$ScriptTag*" }

    if (-not $taggedApps) {
        Write-Host "No tagged apps found. Nothing to remove." -ForegroundColor Green
        exit 0
    }

    foreach ($app in $taggedApps) {
        if ($PSCmdlet.ShouldProcess($app.DisplayName, "Delete application")) {
            Write-Host "  Removing: $($app.DisplayName)" -ForegroundColor Red
            Remove-MgApplication -ApplicationId $app.Id
        }
    }
    Write-Host "`nDone. $($taggedApps.Count) app(s) removed." -ForegroundColor Green
    exit 0
}

#endregion

#region -- Resolve users -----------------------------------------------------

Write-Host "Resolving users from tenant '$TenantDomain'..." -ForegroundColor Cyan

# Fetch all tenant users in one call then match locally.
# This avoids per-UPN 404s when the signed-in account has limited delegated
# permissions but can still list the directory.
$allTenantUsers = $null
try {
    $allTenantUsers = Get-MgUser -All -Property Id,DisplayName,UserPrincipalName -ErrorAction Stop
    Write-Verbose "  Fetched $($allTenantUsers.Count) users from tenant"
} catch {
    Write-Error "Failed to list tenant users: $_`n`nMake sure you signed in with a tenant admin account (not a personal Microsoft account)."
    exit 1
}

# Build a UPN -> MgUser lookup (case-insensitive)
$upnIndex = @{}
foreach ($tu in $allTenantUsers) {
    $upnIndex[$tu.UserPrincipalName.ToLower()] = $tu
}

$UserMap = @{}  # empId -> MgUser object

foreach ($u in $Users) {
    $upn = "$($u.Prefix)@$TenantDomain"
    $mgUser = $upnIndex[$upn.ToLower()]
    if ($mgUser) {
        $UserMap[$u.Id] = $mgUser
        Write-Verbose "  Found: $upn ($($mgUser.Id))"
    } else {
        # Also try matching just by the prefix part (handles UPN suffix differences)
        $match = $allTenantUsers | Where-Object {
            $_.UserPrincipalName -like "$($u.Prefix)@*"
        } | Select-Object -First 1
        if ($match) {
            $UserMap[$u.Id] = $match
            Write-Verbose "  Found (suffix match): $($match.UserPrincipalName)"
        } else {
            Write-Warning "  User not found: $upn - skipping their assignments"
        }
    }
}

$found = $UserMap.Count
Write-Host "  $found / $($Users.Count) users resolved.`n"

if ($found -eq 0) {
    Write-Host "`nAll tenant users found:" -ForegroundColor Yellow
    $allTenantUsers | Select-Object DisplayName, UserPrincipalName | Format-Table -AutoSize
    Write-Error "No script users matched. The UPNs above are what exist in the tenant."
    exit 1
}

#endregion

#region -- Create apps & assign users ----------------------------------------

# Build a lookup: toolId -> list of empIds
$ToolAssignments = @{}
foreach ($record in $AccessRecords) {
    if (-not $ToolAssignments[$record.ToolId]) { $ToolAssignments[$record.ToolId] = @() }
    $ToolAssignments[$record.ToolId] += $record.EmpId
}

$DefaultRoleId = [Guid]::Empty.ToString()  # "00000000-0000-0000-0000-000000000000"
$CreatedCount   = 0
$SkippedCount   = 0
$AssignedCount  = 0

foreach ($tool in $Tools) {
    $displayName = $tool.Name

    # -- 1. Find or create the Application registration ----------------------
    $existing = Get-MgApplication -Filter "displayName eq '$displayName'" -ErrorAction SilentlyContinue |
                Where-Object { $_.Notes -like "*$ScriptTag*" } |
                Select-Object -First 1

    if ($existing) {
        Write-Host "  [SKIP] App already exists: $displayName" -ForegroundColor DarkGray
        $appId  = $existing.Id
        $appOid = $existing.AppId
        $SkippedCount++
    } else {
        if ($PSCmdlet.ShouldProcess($displayName, "Create Enterprise App")) {
            Write-Host "  [CREATE] $displayName" -ForegroundColor Green

            $newApp = New-MgApplication -DisplayName $displayName `
                -SignInAudience "AzureADMyOrg" `
                -Notes "$ScriptTag Category=$($tool.Category) Website=$($tool.Website)"

            $appId  = $newApp.Id
            $appOid = $newApp.AppId
            $CreatedCount++
        }
    }

    # -- 2. Find or create the Service Principal ------------------------------
    $sp = Get-MgServicePrincipal -Filter "appId eq '$appOid'" -ErrorAction SilentlyContinue |
          Select-Object -First 1

    if (-not $sp) {
        if ($PSCmdlet.ShouldProcess($displayName, "Create Service Principal")) {
            $spParams = @{
                AppId                    = $appOid
                AppRoleAssignmentRequired = $true
                Tags                     = @("WindowsAzureActiveDirectoryIntegratedApp")
            }
            $sp = New-MgServicePrincipal -BodyParameter $spParams
            Write-Verbose "    Service principal created: $($sp.Id)"
        }
    } elseif (-not $sp.AppRoleAssignmentRequired) {
        Update-MgServicePrincipal -ServicePrincipalId $sp.Id -BodyParameter @{ AppRoleAssignmentRequired = $true }
    }

    if (-not $sp) { continue }

    # -- 3. Assign users ------------------------------------------------------
    $empIds = $ToolAssignments[$tool.Id]
    if (-not $empIds) {
        Write-Verbose "    No assignments defined for $($tool.Id)"
        continue
    }

    # Get existing assignments to avoid duplicates
    $existingAssignments = Get-MgServicePrincipalAppRoleAssignment `
        -ServicePrincipalId $sp.Id -ErrorAction SilentlyContinue
    $assignedUserIds = $existingAssignments.PrincipalId

    foreach ($empId in $empIds) {
        $mgUser = $UserMap[$empId]
        if (-not $mgUser) { continue }

        if ($assignedUserIds -contains $mgUser.Id) {
            Write-Verbose "    [SKIP] $($mgUser.DisplayName) already assigned to $displayName"
            continue
        }

        if ($PSCmdlet.ShouldProcess("$($mgUser.DisplayName) -> $displayName", "Assign user")) {
            try {
                New-MgServicePrincipalAppRoleAssignment `
                    -ServicePrincipalId $sp.Id `
                    -PrincipalId        $mgUser.Id `
                    -ResourceId         $sp.Id `
                    -AppRoleId          $DefaultRoleId | Out-Null

                Write-Verbose "    Assigned: $($mgUser.DisplayName)"
                $AssignedCount++
            } catch {
                Write-Warning "    Failed to assign $($mgUser.DisplayName) to $displayName`: $_"
            }
        }
    }
}

#endregion

#region -- Summary -----------------------------------------------------------

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "  Apps created : $CreatedCount"
Write-Host "  Apps skipped : $SkippedCount (already existed)"
Write-Host "  Assignments  : $AssignedCount"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open Stacklens -> Settings -> Directory Sync"
Write-Host "  2. Click Authorise and sign in with your admin account"
Write-Host "  3. The sync will import users and you can cross-reference app access"
Write-Host ""
Write-Host "To remove all test apps:"
Write-Host "  .\Assign-NexusApps.ps1 -TenantDomain '$TenantDomain' -RemoveAll"

#endregion
