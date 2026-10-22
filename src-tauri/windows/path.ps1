# Adds a directory to the current user's PATH, or removes it. Run by the NSIS installer and
# uninstaller. Reads and writes the raw registry value so `%VAR%` entries stay unexpanded.
param(
  [Parameter(Mandatory)][ValidateSet('add', 'remove')][string]$Action,
  [Parameter(Mandatory)][string]$Dir
)

$dir = $Dir.Trim('"').TrimEnd('\')
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
$raw = [string]$key.GetValue('Path', '', 'DoNotExpandEnvironmentNames')
$parts = @($raw -split ';' | Where-Object { $_ -ne '' -and $_.TrimEnd('\') -ne $dir })
if ($Action -eq 'add') { $parts += $dir }
$key.SetValue('Path', ($parts -join ';'), 'ExpandString')
$key.Close()
