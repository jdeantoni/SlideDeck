#!/bin/bash
#
# Build and compile SlideDeck files to HTML
#
# Usage:
#   ./build-and-compile.sh <input> [output] [--skip-build]
#
# Arguments:
#   input       Path to a .slidedeck or .sdml file, or a directory containing them
#   output      Output directory for generated HTML files (optional, default: same as input)
#   --skip-build Skip the build step (langium:generate and tsc)
#
# Examples:
#   ./build-and-compile.sh examples/sdml/01-simple-markdown.slidedeck
#   ./build-and-compile.sh examples output
#   ./build-and-compile.sh examples/sdml/01-simple-markdown.slidedeck "" --skip-build

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Parse arguments
INPUT="$1"
OUTPUT="${2:-}"
SKIP_BUILD=false

for arg in "$@"; do
    if [ "$arg" == "--skip-build" ]; then
        SKIP_BUILD=true
    fi
done

# Validate input
if [ -z "$INPUT" ]; then
    print_error "Usage: $0 <input> [output] [--skip-build]"
    exit 1
fi

# Build the project
if [ "$SKIP_BUILD" = false ]; then
    print_info "Building Langium grammar..."
    npm run langium:generate || {
        print_error "Langium generation failed"
        exit 1
    }
    
    print_info "Compiling TypeScript..."
    npm run build || {
        print_error "TypeScript compilation failed"
        exit 1
    }
    print_success "Build completed"
else
    print_info "Skipping build step"
fi

# Check if input is a file or directory
if [ -f "$INPUT" ]; then
    # Single file
    filename=$(basename "$INPUT")
    name="${filename%.*}"
    
    if [ -z "$OUTPUT" ]; then
        output_file="${INPUT%.*}.html"
    else
        mkdir -p "$OUTPUT"
        output_file="$OUTPUT/$name.html"
    fi
    
    print_info "Compiling $INPUT..."
    if node ./out/cli/main.js compile "$INPUT" -o "$output_file"; then
        print_success "Generated: $output_file"
    else
        print_error "Failed to compile $INPUT"
        exit 1
    fi
    
elif [ -d "$INPUT" ]; then
    # Directory - compile all supported files
    shopt -s nullglob
    sdml_files=("$INPUT"/*.slidedeck "$INPUT"/*.sdml)
    shopt -u nullglob

    if [ "${#sdml_files[@]}" -eq 0 ]; then
        print_error "No .slidedeck or .sdml files found in $INPUT"
        exit 1
    fi

    for file in "${sdml_files[@]}"; do
        if [[ "$file" == *.slidedeck && -f "${file%.slidedeck}.sdml" ]]; then
            print_error "Multiple presentation files would generate $(basename "${file%.slidedeck}").html"
            exit 1
        fi
    done
    
    count=${#sdml_files[@]}
    print_info "Found $count presentation file(s) in $INPUT"
    
    success_count=0
    fail_count=0
    
    for file in "${sdml_files[@]}"; do
        filename=$(basename "$file")
        name="${filename%.*}"
        
        if [ -z "$OUTPUT" ]; then
            output_file="${file%.*}.html"
        else
            mkdir -p "$OUTPUT"
            output_file="$OUTPUT/$name.html"
        fi
        
        print_info "Compiling $filename..."
        if node ./out/cli/main.js compile "$file" -o "$output_file"; then
            print_success "Generated: $output_file"
            ((success_count+=1))
        else
            print_error "Failed to compile $filename"
            ((fail_count+=1))
        fi
    done
    
    echo ""
    print_info "Compilation complete: $success_count succeeded, $fail_count failed"
    
    if [ $fail_count -gt 0 ]; then
        exit 1
    fi
    
else
    print_error "Input path does not exist: $INPUT"
    exit 1
fi

print_success "All done!"
