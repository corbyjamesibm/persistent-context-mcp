#\!/bin/bash

# Fetch real ATP data from IBM instance for resource allocations
# This script uses curl to directly call the IBM ATP API

echo "Fetching real ATP data from IBM instance (usibmsandbox.tpondemand.com)..."

# ATP credentials - IBM Instance
TP_DOMAIN="${TP_DOMAIN:-usibmsandbox.tpondemand.com}"
TP_USERNAME="${TP_USERNAME:-admin}"
TP_PASSWORD="${TP_PASSWORD:-admin}"
TP_API_KEY="${TP_API_KEY:-}"

# Output file
OUTPUT_FILE="ibm-atp-allocations.json"

# Create temporary files for each data type
USERS_FILE="/tmp/ibm_atp_users.json"
TEAMS_FILE="/tmp/ibm_atp_teams.json"
PROJECTS_FILE="/tmp/ibm_atp_projects.json"
EPICS_FILE="/tmp/ibm_atp_epics.json"
ALLOCATIONS_FILE="/tmp/ibm_atp_allocations.json"

# Function to make API calls with proper authentication
make_api_call() {
    local endpoint=$1
    local output_file=$2
    
    if [ -n "$TP_API_KEY" ]; then
        curl -s "https://$TP_DOMAIN/api/v1/${endpoint}&access_token=$TP_API_KEY" -o "$output_file"
    else
        curl -s -u "$TP_USERNAME:$TP_PASSWORD" "https://$TP_DOMAIN/api/v1/${endpoint}" -o "$output_file"
    fi
}

echo "1. Fetching Users (GeneralUsers) - First 1000..."
make_api_call "GeneralUsers?take=1000&skip=0&include=[Role,Skills]&format=json" "$USERS_FILE"

echo "2. Fetching Teams..."
make_api_call "Teams?take=1000&include=[Project]&format=json" "$TEAMS_FILE"

echo "3. Fetching Projects..."
make_api_call "Projects?take=1000&format=json" "$PROJECTS_FILE"

echo "4. Fetching Portfolio Epics..."
make_api_call "Epics?take=1000&include=[Project,CustomFields]&format=json" "$EPICS_FILE"

echo "5. Fetching Work Allocations (with pagination)..."
# First batch
make_api_call "WorkAllocations?take=1000&skip=0&include=[ConnectedTeam,PortfolioEpic,ConnectedUser,CustomFields]&format=json" "$ALLOCATIONS_FILE"

# Check if we got data
if [ -f "$USERS_FILE" ] && [ -f "$TEAMS_FILE" ] && [ -f "$PROJECTS_FILE" ] && [ -f "$EPICS_FILE" ] && [ -f "$ALLOCATIONS_FILE" ]; then
    # Combine all data into a single JSON file
    echo "6. Combining data..."
    cat > "$OUTPUT_FILE" << EOFDATA
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "IBM ATP ($TP_DOMAIN)",
  "users": $(cat "$USERS_FILE" 2>/dev/null | jq '.Items // []' || echo "[]"),
  "teams": $(cat "$TEAMS_FILE" 2>/dev/null | jq '.Items // []' || echo "[]"),
  "projects": $(cat "$PROJECTS_FILE" 2>/dev/null | jq '.Items // []' || echo "[]"),
  "epics": $(cat "$EPICS_FILE" 2>/dev/null | jq '.Items // []' || echo "[]"),
  "allocations": $(cat "$ALLOCATIONS_FILE" 2>/dev/null | jq '.Items // []' || echo "[]")
}
EOFDATA

    # Summary
    echo ""
    echo "=== Summary ==="
    echo "Domain: $TP_DOMAIN"
    echo "Users: $(cat "$USERS_FILE" 2>/dev/null | jq '.Items | length' || echo "0")"
    echo "Teams: $(cat "$TEAMS_FILE" 2>/dev/null | jq '.Items | length' || echo "0")"
    echo "Projects: $(cat "$PROJECTS_FILE" 2>/dev/null | jq '.Items | length' || echo "0")"
    echo "Portfolio Epics: $(cat "$EPICS_FILE" 2>/dev/null | jq '.Items | length' || echo "0")"
    echo "Work Allocations: $(cat "$ALLOCATIONS_FILE" 2>/dev/null | jq '.Items | length' || echo "0")"
    echo ""
    echo "Data saved to: $OUTPUT_FILE"

    # Show sample data
    echo ""
    echo "=== Sample Users ==="
    cat "$USERS_FILE" 2>/dev/null | jq '.Items[0:3] | .[] | {Id, FullName, Email}' || echo "No user data"
    
    echo ""
    echo "=== Sample Teams ==="
    cat "$TEAMS_FILE" 2>/dev/null | jq '.Items[0:5] | .[] | {Id, Name, ProjectName: .Project.Name}' || echo "No team data"
else
    echo "ERROR: Failed to fetch data from ATP. Check your credentials and network connection."
    echo "Domain: $TP_DOMAIN"
fi

# Cleanup
rm -f "$USERS_FILE" "$TEAMS_FILE" "$PROJECTS_FILE" "$EPICS_FILE" "$ALLOCATIONS_FILE"
