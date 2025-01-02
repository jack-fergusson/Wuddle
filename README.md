Bingo Card Project

NOTES:

    - Going to have to use persistence. Likely MongoDB. This will retain all the squares in a particular sub-URL.
    - Upon form submission, the 9 entries will be added to DB along with unique random identifier and OG ordering
    - Each new user will get sub-sub-URL with a spot in the DB and new random BINGO ordering
    - Socket.io to maintain realtime dashboard of all user's BINGO boards, also updated in the DB.
    - Cookies to remember user's room/session

TO DO:

    Step 1 (3x3 with sharing)

    - Auto redirect to correct room based on cookies.
    - Create middleware to check db for user ID correctness
    - Create the boards page to show blank versions of all boards in this room in the db with names
    - Use sockets with rooms to have each user's boards updated on the main boards page.


FLOW:

    /: Enter home page. If cookie for roomID -> route to roomID. Else get them to fill out form for new room
    /roomID: Purely routing. If no playerID cookie route to signup. Else route to playerID page
    /roomID/playerID: View and make changes to your individual board. 
    /roomID/boards: See all boards

