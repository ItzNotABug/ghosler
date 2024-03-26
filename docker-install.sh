#!/bin/bash

# Define color codes
NC='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD_GREEN='\033[1;32m'

# Set default values
DEFAULT_PORT=2369
DEFAULT_CONTAINER_NAME="ghosler"

echo ""
echo -e "${BOLD_GREEN}Note: If you are UPDATING, use the same PORT & CONTAINER NAME!${NC}"
echo ""

# Prompt for port number with default
echo -e "${GREEN}Provide a port for Ghosler [Default: $DEFAULT_PORT]${NC} : "
read -r PORT
PORT=${PORT:-$DEFAULT_PORT}

# Prompt for container name with default
echo -e "${GREEN}Provide a name for Ghosler Container [Default: $DEFAULT_CONTAINER_NAME]${NC} : "
read -r CONTAINER_NAME
CONTAINER_NAME=${CONTAINER_NAME:-$DEFAULT_CONTAINER_NAME}

# Fetch the releases from GitHub API
releases=$(curl -s "https://api.github.com/repos/itznotabug/ghosler/releases")

# latest version
LATEST_VERSION=""

# Loop through each line in the releases
while read -r line; do
    # Check if the line contains "tag_name" and LATEST_VERSION is not set
    if [[ $line == *"tag_name"* && -z $LATEST_VERSION ]]; then
        # Extract the version from the line
        LATEST_VERSION=$(echo "$line" | cut -d '"' -f 4)
        break
    fi
done <<< "$releases"

# Check if a version was found
if [[ -z "$LATEST_VERSION" ]]; then
    LATEST_VERSION="0.94" # default to the docker supported version.
fi

echo -e "${GREEN}Starting Ghosler Docker installation...${NC}"
echo ""

# Use the variables in the docker run command
if ! docker run --rm --name "$CONTAINER_NAME" -d -p "$PORT":2369 -v "${CONTAINER_NAME}"-logs:/usr/src/app/.logs -v "${CONTAINER_NAME}"-analytics:/usr/src/app/files -v "${CONTAINER_NAME}"-configuration:/usr/src/app/configuration itznotabug/ghosler:"${LATEST_VERSION}"; then
    echo ""
    echo -e "${RED}Error: Failed to start Ghosler. Please check the Docker logs for more details.${NC}" >&2
    exit 1
fi

echo ""
echo -e "${GREEN}Ghosler has been successfully installed and started.${NC}"