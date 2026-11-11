#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build and compile SlideDeck files to HTML
.DESCRIPTION
    This script builds the Langium grammar and compiles .slidedeck or .sdml files to HTML presentations.
    It can process a single file or all files in a directory.
.PARAMETER Input
    Path to a .slidedeck or .sdml file or directory containing them
.PARAMETER Output
    Output directory for generated HTML files (default: same as input)
.PARAMETER SkipBuild
    Skip the build step (langium:generate and tsc)
.EXAMPLE
    .\build-and-compile.ps1 -InputPath examples/sdml/01-simple-markdown.slidedeck
.EXAMPLE
    .\build-and-compile.ps1 -InputPath examples -OutputPath output
.EXAMPLE
    .\build-and-compile.ps1 -InputPath examples/sdml/01-simple-markdown.slidedeck -SkipBuild
#>

param(
    [Parameter(Mandatory=$true, HelpMessage="Path to .slidedeck or .sdml file or directory")]
    [string]$InputPath,
    
    [Parameter(Mandatory=$false, HelpMessage="Output directory for HTML files")]
    [string]$OutputPath = "",
    
    [Parameter(Mandatory=$false, HelpMessage="Skip build step")]
    [switch]$SkipBuild
)

# Colors for output
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Error-Custom { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Cyan }

# Build the project
if (-not $SkipBuild) {
    Write-Info "Building Langium grammar..."
    npm run langium:generate
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Langium generation failed"
        exit 1
    }
    
    Write-Info "Compiling TypeScript..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "TypeScript compilation failed"
        exit 1
    }
    Write-Success "Build completed"
} else {
    Write-Info "Skipping build step"
}

# Check if input is a file or directory
if (Test-Path $InputPath -PathType Leaf) {
    # Single file
    $inputFile = $InputPath
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($inputFile)
    
    if ($OutputPath -eq "") {
        $outputFile = [System.IO.Path]::ChangeExtension($inputFile, ".html")
    } else {
        if (-not (Test-Path $OutputPath)) {
            New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
        }
        $outputFile = Join-Path $OutputPath "$fileName.html"
    }
    
    Write-Info "Compiling $inputFile..."
    node ./out/cli/main.js compile $inputFile -o $outputFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Generated: $outputFile"
    } else {
        Write-Error-Custom "Failed to compile $inputFile"
        exit 1
    }
    
} elseif (Test-Path $InputPath -PathType Container) {
    # Directory - compile all supported files
    $sdmlFiles = @(Get-ChildItem -Path $InputPath -File | Where-Object { $_.Extension -in '.slidedeck', '.sdml' })
    
    if ($sdmlFiles.Count -eq 0) {
        Write-Error-Custom "No .slidedeck or .sdml files found in $InputPath"
        exit 1
    }

    $outputNames = @{}
    foreach ($file in $sdmlFiles) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        if ($outputNames.ContainsKey($name)) {
            Write-Error-Custom "Multiple presentation files would generate $name.html"
            exit 1
        }
        $outputNames[$name] = $true
    }
    
    Write-Info "Found $($sdmlFiles.Count) presentation file(s) in $InputPath"
    
    $successCount = 0
    $failCount = 0
    
    foreach ($file in $sdmlFiles) {
        $fileName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        
        if ($OutputPath -eq "") {
            $outputFile = Join-Path $file.DirectoryName "$fileName.html"
        } else {
            if (-not (Test-Path $OutputPath)) {
                New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
            }
            $outputFile = Join-Path $OutputPath "$fileName.html"
        }
        
        Write-Info "Compiling $($file.Name)..."
        node ./out/cli/main.js compile $file.FullName -o $outputFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Generated: $outputFile"
            $successCount++
        } else {
            Write-Error-Custom "Failed to compile $($file.Name)"
            $failCount++
        }
    }
    
    Write-Host ""
    Write-Info "Compilation complete: $successCount succeeded, $failCount failed"
    
    if ($failCount -gt 0) {
        exit 1
    }
    
} else {
    Write-Error-Custom "Input path does not exist: $InputPath"
    exit 1
}

Write-Success "All done!"
