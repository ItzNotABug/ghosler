#!/bin/bash

# Define color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Ghosler Docker installation...${NC}"
echo ""

if ! docker run --rm --name ghosler -d -p 2369:2369 -v ghosler-logs:/usr/src/app/.logs -v ghosler-analytics:/usr/src/app/files -v ghosler-configuration:/usr/src/app/configuration itznotabug/ghosler:0.94; then
    echo ""
    echo -e "${RED}Error: Failed to start Ghosler. Please check the Docker logs for more details.${NC}" >&2
    exit 1
fi

echo ""
echo -e "${GREEN}Ghosler has been successfully installed and started.${NC}"