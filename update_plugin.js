@
const fs = require("fs");
let plugin = fs.readFileSync("plugins/withAndroidShakeDetector.js", "utf8");
const sd = fs.readFileSync("android/app/src/main/java/com/pocketwise/app/shake/ShakeDetector.kt", "utf8");
const sds = fs.readFileSync("android/app/src/main/java/com/pocketwise/app/shake/ShakeDetectionService.kt", "utf8");
const qea = fs.readFileSync("android/app/src/main/java/com/pocketwise/app/shake/QuickExpenseActivity.kt", "utf8");

function esc(str) {
    return str.replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

plugin = plugin.replace(/const shakeDetectorContent = `[\s\S]*?`;/, () => "const shakeDetectorContent = `" + esc(sd) + "`;");
plugin = plugin.replace(/const shakeServiceContent = `[\s\S]*?`;/, () => "const shakeServiceContent = `" + esc(sds) + "`;");
plugin = plugin.replace(/const quickExpenseActivityContent = `[\s\S]*?`;/, () => "const quickExpenseActivityContent = `" + esc(qea) + "`;");

fs.writeFileSync("plugins/withAndroidShakeDetector.js", plugin);
console.log("Plugin updated successfully");
@
