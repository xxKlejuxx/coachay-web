@echo off
echo === Sprawdzanie trenera 'Nadia Testowa' w Firebase ===
echo.

REM Pobierz token Firebase CLI
echo 1. Pobieranie tokena Firebase CLI...
for /f "tokens=%%a" %%i in ('C:\Users\rafal\.config\configstore\firebase-tools.json') do (
    set FIREBASE_TOKEN=%%i
)
if "%FIREBASE_TOKEN%"=="" (
    echo ❌ Nie udało się uzyskać tokena Firebase
    pause
    exit /b 1
)

echo ✅ Token uzyskany: %FIREBASE_TOKEN:~0,20%...
echo.

REM Konfiguracja
set PROJECT_ID=coachay-5c3c9
set BASE_URL=https://firestore.googleapis.com/v1/projects/%PROJECT_ID%/databases/(default)/documents

echo 2. Sprawdzanie trenera...
echo URL: %BASE_URL%/trainers

REM Sprawdź trenera
curl -s -H "Authorization: Bearer %FIREBASE_TOKEN%" ^
    -H "Content-Type: application/json" ^
    "%BASE_URL%/trainers" > trainer_response.json

set /p TRAINER_STATUS=<type trainer_response.json | jq -r ".error // "OK""
if "%TRAINER_STATUS%"=="OK" (
    REM Parsowanie danych trenera
    set /p TRAINER_DATA=<type trainer_response.json | jq -r ".documents[0] // empty"
    if not "%TRAINER_DATA%"=="empty" (
        echo ✅ Znaleziono trenera:
        set /p TRAINER_ID=<type trainer_response.json | jq -r ".documents[0].name | split("/") | last"
        set /p TRAINER_FIELDS=<type trainer_response.json | jq -r ".documents[0].fields"
        
        echo ID trenera: %TRAINER_ID%
        echo DisplayName: <type trainer_response.json | jq -r ".documents[0].fields.displayName.stringValue // "Brak""
        echo Email: <type trainer_response.json | jq -r ".documents[0].fields.email.stringValue // "Brak""
        echo Status: <type trainer_response.json | jq -r ".documents[0].fields.status.stringValue // "Brak""
        echo Club ID: <type trainer_response.json | jq -r ".documents[0].fields.clubId.stringValue // "Brak""
        echo User ID: <type trainer_response.json | jq -r ".documents[0].fields.userId.stringValue // "Brak""
        echo Role: <type trainer_response.json | jq -r ".documents[0].fields.role.stringValue // "Brak""
        echo Is Club Admin: <type trainer_response.json | jq -r ".documents[0].fields.isClubAdmin.booleanValue // false"
        echo Team IDs: <type trainer_response.json | jq -r ".documents[0].fields.teamIds.arrayValue.values // []"
        echo.
        
        REM Sprawdź memberships
        echo 3. Sprawdzanie memberships dla trenera...
        set /p USER_ID=<type trainer_response.json | jq -r ".documents[0].fields.userId.stringValue // empty"
        
        if "%USER_ID%"=="" (
            echo ❌ Trener nie ma userId - nie można sprawdzić memberships
        ) else (
            curl -s -H "Authorization: Bearer %FIREBASE_TOKEN%" ^
                -H "Content-Type: application/json" ^
                "%BASE_URL%/memberships?where=userId==\"%USER_ID%\"" > membership_response.json
            
            set /p MEMBERSHIP_STATUS=<type membership_response.json | jq -r ".error // "OK""
            if "%MEMBERSHIP_STATUS%"=="OK" (
                set /p MEMBERSHIP_COUNT=<type membership_response.json | jq -r ".documents | length"
                if %MEMBERSHIP_COUNT% EQU 0 (
                    echo ❌ Nie znaleziono żadnych memberships dla tego trenera
                ) else (
                    echo ✅ Znaleziono %MEMBERSHIP_COUNT% memberships:
                    
                    for /l %%i in (0,1,%MEMBERSHIP_COUNT%) do (
                        echo --- Membership %%i+1 ---
                        set /p MEMBERSHIP=<type membership_response.json | jq -r ".documents[%%i]"
                        set /p MEMBERSHIP_ID=<type membership_response.json | jq -r ".documents[%%i].name | split("/") | last"
                        set /p MEMBERSHIP_FIELDS=<type membership_response.json | jq -r ".documents[%%i].fields"
                        
                        echo ID: %MEMBERSHIP_ID%
                        echo Club ID: <type membership_response.json | jq -r ".documents[%%i].fields.clubId.stringValue // "Brak""
                        echo Team ID: <type membership_response.json | jq -r ".documents[%%i].fields.teamId.stringValue // "Brak""
                        echo Role: <type membership_response.json | jq -r ".documents[%%i].fields.role.stringValue // "Brak""
                        echo Status: <type membership_response.json | jq -r ".documents[%%i].fields.status.stringValue // "Brak""
                        echo Joined At: <type membership_response.json | jq -r ".documents[%%i].fields.joinedAt.timestampValue // "Brak""
                        echo Added By: <type membership_response.json | jq -r ".documents[%%i].fields.addedBy.stringValue // "Brak""
                        
                        set /p TEAM_ID=<type membership_response.json | jq -r ".documents[%%i].fields.teamId.stringValue // empty"
                        if "%TEAM_ID%"=="" (
                            echo → Przypisanie tylko do klubu ^bez drużyny^
                        ) else (
                            echo → Ma przypisanie do drużyny: %TEAM_ID%
                        )
                        echo.
                    )
                )
            )
        )
    ) else (
        echo ❌ Błąd podczas sprawdzania trenera:
        type trainer_response.json | jq -r ".error.message"
    )
) else (
    echo ❌ Błąd HTTP podczas sprawdzania trenera: %TRAINER_STATUS%
    type trainer_response.json | jq -r ".error.message"
)

echo.
echo === Koniec sprawdzania ===
del trainer_response.json membership_response.json
pause
