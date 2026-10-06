<#
.SYNOPSIS
  Daily backup of the Nazareth Holy Cross MongoDB database on a Windows PC, with 30-day rotation.

.DESCRIPTION
  Runs server\scripts\backup.js (read-only: it only reads the database) and writes a dated folder
  nhc-backup-YYYYMMDD-HHMMSS under -BackupFolder (manifest.json with counts and SHA-256, one .ndjson.gz per collection).
  Afterwards it deletes backups older than -KeepDays, but ONLY after a new backup succeeded, and never so many that
  fewer than -KeepAtLeast remain. A failed backup deletes nothing.

  The database address is a secret. It is never an argument and is never printed:
    * -Setup asks for it once (hidden) and stores it encrypted with Windows DPAPI under
      %USERPROFILE%\.nhc-backup\database-url.dpapi. Only THIS Windows user on THIS PC can decrypt it.
    * A normal run decrypts it into the DATABASEURL variable of the backup process only.
    * If DATABASEURL is already set in the environment it is used instead (for tests).

  Scheduling (docs\BACKUP.md): -Register creates the Windows scheduled task "NHC MongoDB Backup" that runs this script
  every day while you are SIGNED IN (logon type Interactive, like your other tasks): DPAPI needs your profile, and a
  task that runs signed out (S4U) cannot decrypt the file. If the PC was off at the scheduled time the task runs as soon
  as possible afterwards (StartWhenAvailable).

.EXAMPLE
  .\backup-windows.ps1 -Setup                              # once: store the database address, encrypted
  .\backup-windows.ps1 -BackupFolder D:\NHC-Backups        # one backup now (the same thing the task runs)
  .\backup-windows.ps1 -BackupFolder D:\NHC-Backups -Register -At 03:30
  .\backup-windows.ps1 -Unregister
#>
[CmdletBinding()]
param(
  [string] $BackupFolder,
  [int] $KeepDays = 30,
  [int] $KeepAtLeast = 7,
  [switch] $Setup,
  [switch] $Register,
  [switch] $Unregister,
  [string] $At = '03:30',
  [string] $ServerDir = (Join-Path $PSScriptRoot '..\server'),
  [string] $NodeExe,
  [string] $SecretFile = (Join-Path $env:USERPROFILE '.nhc-backup\database-url.dpapi'),
  [string] $TaskName = 'NHC MongoDB Backup'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:LogFile = $null

function Write-Log([string] $Message) {
  $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $Message
  Write-Host $line
  if ($script:LogFile) { Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8 }
}

# ---------------------------------------------------------------- one-time setup of the secret
if ($Setup) {
  $secure = Read-Host -AsSecureString 'MongoDB connection string (mongodb+srv://...), input is hidden'
  $plain = [System.Net.NetworkCredential]::new('', $secure).Password
  try {
    if ($plain -notmatch '^mongodb(\+srv)?://') { throw 'That does not look like a MongoDB connection string (it must start with mongodb:// or mongodb+srv://).' }
    $folder = Split-Path -Parent $SecretFile
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    ConvertFrom-SecureString -SecureString $secure | Set-Content -LiteralPath $SecretFile -Encoding ASCII
  } finally {
    $plain = $null
  }
  Write-Host "Stored, encrypted for this Windows user on this PC: $SecretFile"
  Write-Host 'Next: run the script once with -BackupFolder to check it works, then add -Register.'
  return
}

# ---------------------------------------------------------------- the scheduled task
if ($Unregister) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed the scheduled task '$TaskName'."
  } else {
    Write-Host "There is no scheduled task '$TaskName'."
  }
  return
}

if ($Register) {
  if (-not $BackupFolder) { throw 'Give -BackupFolder: the folder the backups are written to.' }
  $time = [datetime]::ParseExact($At, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
  $script = $MyInvocation.MyCommand.Path
  $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -BackupFolder "{1}" -KeepDays {2} -KeepAtLeast {3}' -f $script, $BackupFolder, $KeepDays, $KeepAtLeast
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
  $trigger = New-ScheduledTaskTrigger -Daily -At $time
  # Interactive = "run only when the user is logged on", the same as your other tasks. DPAPI needs the user's profile.
  $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Daily read-only backup of the Nazareth Holy Cross MongoDB database (docs/BACKUP.md).' -Force | Out-Null
  Write-Host "Registered '$TaskName': every day at $At while you are signed in; backups go to $BackupFolder (kept $KeepDays days)."
  Write-Host 'Try it now: Start-ScheduledTask -TaskName "NHC MongoDB Backup"; then look at backup.log in the backup folder.'
  return
}

# ---------------------------------------------------------------- the backup
if (-not $BackupFolder) { throw 'Give -BackupFolder (the folder the backups are written to), or use -Setup / -Register / -Unregister.' }
New-Item -ItemType Directory -Force -Path $BackupFolder | Out-Null
$BackupFolder = (Resolve-Path -LiteralPath $BackupFolder).Path
$script:LogFile = Join-Path $BackupFolder 'backup.log'

$existingUrl = $env:DATABASEURL
$started = Get-Date
try {
  if (-not $env:DATABASEURL) {
    if (-not (Test-Path -LiteralPath $SecretFile)) { throw "The database address is not stored yet. Run:  .\backup-windows.ps1 -Setup   (file expected: $SecretFile)" }
    try {
      $secure = (Get-Content -LiteralPath $SecretFile -Raw).Trim() | ConvertTo-SecureString
    } catch {
      throw 'The stored database address cannot be decrypted. It can only be read by the Windows user who ran -Setup, on the same PC, while signed in (a task set to run signed out cannot read it). Run -Setup again.'
    }
    $env:DATABASEURL = [System.Net.NetworkCredential]::new('', $secure).Password
  }

  if (-not $NodeExe) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node.js was not found on this PC (node must be on the PATH).' }
    $NodeExe = $node.Source
  }
  $ServerDir = (Resolve-Path -LiteralPath $ServerDir).Path
  $backupScript = Join-Path $ServerDir 'scripts\backup.js'
  if (-not (Test-Path -LiteralPath $backupScript)) { throw "Not found: $backupScript (the repository's server folder; run npm ci inside it once)." }

  Write-Log "Backup starting to $BackupFolder"
  Push-Location $ServerDir
  try {
    # The script prints the host and database name (never the address). Its output goes to the log.
    # Windows PowerShell turns a native program's stderr into errors when ErrorActionPreference is Stop: not here.
    $ErrorActionPreference = 'Continue'
    $output = & $NodeExe $backupScript --out $BackupFolder 2>&1
    $exit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = 'Stop'
    Pop-Location
  }
  foreach ($line in @($output)) { if ("$line".Trim()) { Write-Log ("  " + "$line") } }
  if ($exit -ne 0) { throw "backup.js failed (exit code $exit). Nothing was deleted." }

  # The newest complete backup must exist before anything old is removed.
  $complete = Get-ChildItem -LiteralPath $BackupFolder -Directory -Filter 'nhc-backup-*' |
    Where-Object { $_.Name -match '^nhc-backup-\d{8}-\d{6}$' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'manifest.json')) } |
    Sort-Object Name -Descending
  if (-not $complete -or $complete[0].LastWriteTime -lt $started.AddMinutes(-1)) { throw 'The backup finished but no new complete backup folder was found. Nothing was deleted.' }

  # Rotation: older than KeepDays AND not among the newest KeepAtLeast.
  $cutoff = (Get-Date).AddDays(-$KeepDays)
  $protected = @($complete | Select-Object -First $KeepAtLeast | ForEach-Object { $_.FullName })
  $removed = 0
  foreach ($old in $complete) {
    if ($old.LastWriteTime -lt $cutoff -and $protected -notcontains $old.FullName) {
      Remove-Item -LiteralPath $old.FullName -Recurse -Force
      $removed += 1
    }
  }
  # Unfinished folders left by a crash (a .partial is never a backup).
  Get-ChildItem -LiteralPath $BackupFolder -Directory -Filter 'nhc-backup-*.partial' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-2) } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }

  Set-Content -LiteralPath (Join-Path $BackupFolder 'LAST_OK.txt') -Value ('{0:o}  {1}' -f (Get-Date), $complete[0].Name) -Encoding ASCII
  Write-Log ("OK  {0}; {1} kept, {2} older than {3} days removed" -f $complete[0].Name, (@($complete).Count - $removed), $removed, $KeepDays)
} catch {
  Write-Log ("FAILED  " + $_.Exception.Message)
  Set-Content -LiteralPath (Join-Path $BackupFolder 'LAST_FAILED.txt') -Value ('{0:o}  {1}' -f (Get-Date), $_.Exception.Message) -Encoding UTF8
  exit 1
} finally {
  $env:DATABASEURL = $existingUrl
}
if (Test-Path -LiteralPath (Join-Path $BackupFolder 'LAST_FAILED.txt')) { Remove-Item -LiteralPath (Join-Path $BackupFolder 'LAST_FAILED.txt') -Force }
exit 0
