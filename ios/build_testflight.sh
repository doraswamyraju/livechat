#!/bin/bash
set -e

# Change directory to the script's directory
cd "$(dirname "$0")"

# Set Xcode path
export DEVELOPER_DIR="/Applications/Xcode-beta.app/Contents/Developer"

PROJECT_NAME="LetsTrack"
SCHEME_NAME="LetsTrack"
CONFIGURATION="Release"

echo "============================================="
echo "Preparing to build & archive $PROJECT_NAME"
echo "============================================="

# 1. Increment Build Number (CURRENT_PROJECT_VERSION)
PBXPROJ="LetsTrack.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
    CURRENT_VERSION=$(grep -m 1 "CURRENT_PROJECT_VERSION" "$PBXPROJ" | sed -E 's/.*CURRENT_PROJECT_VERSION = ([0-9]+);.*/\1/')
    if [ -n "$CURRENT_VERSION" ]; then
        NEW_VERSION=$((CURRENT_VERSION + 1))
        echo "Incrementing CURRENT_PROJECT_VERSION from $CURRENT_VERSION to $NEW_VERSION..."
        sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT_VERSION;/CURRENT_PROJECT_VERSION = $NEW_VERSION;/g" "$PBXPROJ"
    else
        echo "WARNING: Could not find CURRENT_PROJECT_VERSION in $PBXPROJ"
    fi
else
    echo "ERROR: project.pbxproj not found at $PBXPROJ"
    exit 1
fi

# 2. Build & Archive to default Xcode Archives directory
echo "Archiving project to default organizer path..."
xcodebuild archive \
    -project "${PROJECT_NAME}.xcodeproj" \
    -scheme "$SCHEME_NAME" \
    -configuration "$CONFIGURATION" \
    -destination 'generic/platform=iOS'

echo "============================================="
echo "ARCHIVE CREATED SUCCESSFULLY!"
echo "You can now open Xcode Organizer (Window > Organizer) to view and upload the archive."
echo "============================================="
