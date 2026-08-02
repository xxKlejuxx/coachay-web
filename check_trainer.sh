#!/bin/bash

echo "=== Sprawdzanie trenera 'Nadia Testowa' w Firebase ==="
echo ""

# Pobierz token Firebase CLI
echo "1. Pobieranie tokena Firebase CLI..."
FIREBASE_TOKEN=$(firebase login:ci | grep "Use this token to login on a CI server:" -A1 | tail -1)

if [ -z "$FIREBASE_TOKEN" ]; then
    echo "❌ Nie udało się uzyskać tokena Firebase"
    exit 1
fi

echo "✅ Token uzyskany: ${FIREBASE_TOKEN:0:20}..."
echo ""

# Konfiguracja
PROJECT_ID="coachay-5c3c9"
BASE_URL="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents"

echo "2. Sprawdzanie trenera..."
echo "URL: ${BASE_URL}/trainers"

# Sprawdź trenera
TRAINER_RESPONSE=$(curl -s -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
    -H "Content-Type: application/json" \
    "${BASE_URL}/trainers")

echo "Status: $(echo "$TRAINER_RESPONSE" | jq -r '.error // "OK"')"

if echo "$TRAINER_RESPONSE" | jq -e '.error' > /dev/null; then
    echo "❌ Błąd podczas sprawdzania trenera:"
    echo "$TRAINER_RESPONSE" | jq -r '.error.message'
    exit 1
fi

# Parsowanie danych trenera
TRAINER_DATA=$(echo "$TRAINER_RESPONSE" | jq -r '.documents[0] // empty')

if [ "$TRAINER_DATA" = "empty" ]; then
    echo "❌ Nie znaleziono trenera o nazwie: Nadia Testowa"
    exit 0
fi

echo "✅ Znaleziono trenera:"
TRAINER_ID=$(echo "$TRAINER_DATA" | jq -r '.name | split("/") | last')
TRAINER_FIELDS=$(echo "$TRAINER_DATA" | jq -r '.fields')

echo "ID trenera: $TRAINER_ID"
echo "DisplayName: $(echo "$TRAINER_FIELDS" | jq -r '.displayName.stringValue // "Brak"')"
echo "Email: $(echo "$TRAINER_FIELDS" | jq -r '.email.stringValue // "Brak"')"
echo "Status: $(echo "$TRAINER_FIELDS" | jq -r '.status.stringValue // "Brak"')"
echo "Club ID: $(echo "$TRAINER_FIELDS" | jq -r '.clubId.stringValue // "Brak"')"
echo "User ID: $(echo "$TRAINER_FIELDS" | jq -r '.userId.stringValue // "Brak"')"
echo "Role: $(echo "$TRAINER_FIELDS" | jq -r '.role.stringValue // "Brak"')"
echo "Is Club Admin: $(echo "$TRAINER_FIELDS" | jq -r '.isClubAdmin.booleanValue // false')"
echo "Team IDs: $(echo "$TRAINER_FIELDS" | jq -r '.teamIds.arrayValue.values // []')"
echo ""

# Sprawdź memberships
echo "3. Sprawdzanie memberships dla trenera..."
USER_ID=$(echo "$TRAINER_FIELDS" | jq -r '.userId.stringValue // empty')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
    echo "❌ Trener nie ma userId - nie można sprawdzić memberships"
    exit 0
fi

MEMBERSHIP_RESPONSE=$(curl -s -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
    -H "Content-Type: application/json" \
    "${BASE_URL}/memberships?where=userId==\"${USER_ID}\"")

echo "Membership Status: $(echo "$MEMBERSHIP_RESPONSE" | jq -r '.error // "OK"')"

if echo "$MEMBERSHIP_RESPONSE" | jq -e '.error' > /dev/null; then
    echo "❌ Błąd podczas sprawdzania memberships:"
    echo "$MEMBERSHIP_RESPONSE" | jq -r '.error.message'
    exit 1
fi

# Parsowanie memberships
MEMBERSHIPS=$(echo "$MEMBERSHIP_RESPONSE" | jq -r '.documents // []')
MEMBERSHIP_COUNT=$(echo "$MEMBERSHIPS" | jq 'length')

if [ "$MEMBERSHIP_COUNT" -eq 0 ]; then
    echo "❌ Nie znaleziono żadnych memberships dla tego trenera"
else
    echo "✅ Znaleziono $MEMBERSHIP_COUNT memberships:"
    
    for i in $(seq 0 $((MEMBERSHIP_COUNT-1))); do
        echo "--- Membership $((i+1)) ---"
        MEMBERSHIP=$(echo "$MEMBERSHIPS" | jq -r ".[$i]")
        MEMBERSHIP_ID=$(echo "$MEMBERSHIP" | jq -r '.name | split("/") | last')
        MEMBERSHIP_FIELDS=$(echo "$MEMBERSHIP" | jq -r '.fields')
        
        echo "ID: $MEMBERSHIP_ID"
        echo "Club ID: $(echo "$MEMBERSHIP_FIELDS" | jq -r '.clubId.stringValue // "Brak"')"
        echo "Team ID: $(echo "$MEMBERSHIP_FIELDS" | jq -r '.teamId.stringValue // "Brak"')"
        echo "Role: $(echo "$MEMBERSHIP_FIELDS" | jq -r '.role.stringValue // "Brak"')"
        echo "Status: $(echo "$MEMBERSHIP_FIELDS" | jq -r '.status.stringValue // "Brak"')"
        echo "Joined At: $(echo "$MEMBERSHIP_FIELDS" | jq -r '.joinedAt.timestampValue // "Brak"')"
        echo "Added By: $(echo "$MEMBERSHIP_FIELDS" | jq -r '.addedBy.stringValue // "Brak"')"
        
        TEAM_ID=$(echo "$MEMBERSHIP_FIELDS" | jq -r '.teamId.stringValue // empty')
        if [ -n "$TEAM_ID" ] && [ "$TEAM_ID" != "null" ]; then
            echo "→ Ma przypisanie do drużyny: $TEAM_ID"
        else
            echo "→ Przypisanie tylko do klubu (bez drużyny)"
        fi
        echo ""
    done
fi

echo "=== Koniec sprawdzania ==="
