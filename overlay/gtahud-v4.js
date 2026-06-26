const clock = document.getElementById("clock");
const frame = document.getElementById("frame");
const glow = document.getElementById("glow");
const scanner = document.getElementById("scanner");

let start = performance.now();

function tick(){

    const now = new Date();

    clock.textContent =
        now.toLocaleTimeString("en-GB",{
            hour12:false
        });

    requestAnimationFrame(tick);

}

tick();

let t = 0;

function animate(){

    t += 0.016;

    //
    // breathing animation
    //

    const breathe =
        Math.sin(t*0.6);

    frame.style.transform =
        `translateX(-50%) scale(${1+breathe*0.003})`;

    //
    // glow pulse
    //

    const glowStrength =
        35+
        (Math.sin(t*1.2)+1)*18;

    glow.style.boxShadow = `
        0 0 ${glowStrength}px rgba(0,217,255,.30),
        0 0 ${glowStrength*2}px rgba(0,217,255,.10)
    `;

    //
    // scanner opacity

    scanner.style.opacity =
        .75+
        Math.sin(t*2)*.1;

    requestAnimationFrame(animate);

}

animate();
