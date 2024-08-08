/* When the user clicks on the button,
toggle between hiding and showing the dropdown content */
function dimensionDropDown() {
    document.getElementById("myDropdown").classList.toggle("show");
}

let board = document.getElementById("board");
let visibleExcess = board.getElementsByClassName("excess visible");
let invisibleExcess = board.getElementsByClassName("excess invisible");


function threebythree() {

    // alert("three");

    board.classList.add("threebythree");
    while (visibleExcess.length > 0) {
        visibleExcess.item(0).classList.add("invisible");
        visibleExcess[0].classList.remove("visible");
    }
}

function fourbyfour() {
    // alert("four");
    board.classList.remove("threebythree");
    while (invisibleExcess.length > 0) {
        invisibleExcess.item(0).classList.add("visible");
        invisibleExcess[0].classList.remove("invisible");
    }
}

// function hello() {
//     alert("Hello!");
// }