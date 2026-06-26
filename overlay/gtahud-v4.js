function playDemo(){

const layer=document.getElementById("alertLayer");

const frame=document.getElementById("alertFrame");

layer.style.opacity=1;

frame.style.width="1500px";

frame.style.height="190px";

frame.style.transform="translateY(0)";

setTimeout(()=>{

breakingLabel.style.opacity=1;
breakingLabel.style.transform="translateY(0)";

},250);

setTimeout(()=>{

alertHeadline.style.opacity=1;
alertHeadline.style.transform="scale(1)";

},550);

setTimeout(()=>{

alertUsername.style.opacity=1;
alertUsername.style.transform="translateY(0)";

},800);

setTimeout(()=>{

alertDescription.style.opacity=1;

},950);

setTimeout(()=>{

layer.style.opacity=0;

frame.style.width="980px";
frame.style.height="74px";

breakingLabel.style.opacity=0;
alertHeadline.style.opacity=0;
alertUsername.style.opacity=0;
alertDescription.style.opacity=0;

breakingLabel.style.transform="translateY(-12px)";
alertHeadline.style.transform="scale(.8)";
alertUsername.style.transform="translateY(25px)";

},6500);

}

window.playDemo=playDemo;
