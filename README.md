Bingo Card Project

NOTES:

    - Going to have to use persistence. Likely MongoDB. This will retain all the squares in a particular sub-URL.
    - Upon form submission, the 9 entries will be added to DB along with unique random identifier and OG ordering
    - Each new user will get sub-sub-URL with a spot in the DB and new random BINGO ordering
    - Socket.io to maintain realtime dashboard of alll user's BINGO boards, also updated in the DB.
    - Cookies to remember user's room/session

TO DO:

    Step 1 (3x3 with sharing)

    - Get 9 inputs from user + display name
    - Create a new page with a random URL for this unique board
    - New clicks to the link prompt a user name and get randomized board in URL/1,2,3 etc.
    - Auto redirect to correct room based on cookies.
