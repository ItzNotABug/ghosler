#!/bin/bash

# Define color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Set default values
DEFAULT_PORT=2369
DEFAULT_CONTAINER_NAME="ghosler"

# Prompt for port number with default
echo -e "${GREEN}Provide a port for Ghosler [Default: $DEFAULT_PORT]${NC} : "
read -r PORT
PORT=${PORT:-$DEFAULT_PORT}

# Prompt for container name with default
echo -e "${GREEN}Provide a name for Ghosler Container [Default: $DEFAULT_CONTAINER_NAME]${NC} : "
read -r CONTAINER_NAME
CONTAINER_NAME=${CONTAINER_NAME:-$DEFAULT_CONTAINER_NAME}

echo -e "${GREEN}Starting Ghosler Docker installation...${NC}"
echo ""

# Use the variables in the docker run command
if ! docker run --rm --name "$CONTAINER_NAME" -d -p "$PORT":2369 -v "${CONTAINER_NAME}"-logs:/usr/src/app/.logs -v "${CONTAINER_NAME}"-analytics:/usr/src/app/files -v "${CONTAINER_NAME}"-configuration:/usr/src/app/configuration itznotabug/ghosler:0.94; then
    echo ""
    echo -e "${RED}Error: Failed to start Ghosler. Please check the Docker logs for more details.${NC}" >&2
    exit 1
fi

echo ""
echo -e "${GREEN}Ghosler has been successfully installed and started.${NC}"