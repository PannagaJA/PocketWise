const fs = require('fs');
let plugin = fs.readFileSync('plugins/withAndroidShakeDetector.js', 'utf8');

function escapeKotlin(content) {
    return content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

const sd = fs.readFileSync('android/app/src/main/java/com/pocketwise/app/shake/ShakeDetector.kt', 'utf8');
const sds = fs.readFileSync('android/app/src/main/java/com/pocketwise/app/shake/ShakeDetectionService.kt', 'utf8');
const qea = fs.readFileSync('android/app/src/main/java/com/pocketwise/app/shake/QuickExpenseActivity.kt', 'utf8');

plugin = plugin.replace(/const shakeDetectorContent = `[\s\S]*?`;/, 'const shakeDetectorContent = `' + escapeKotlin(sd) + '`;');
plugin = plugin.replace(/const shakeServiceContent = `[\s\S]*?`;/, 'const shakeServiceContent = `' + escapeKotlin(sds) + '`;');
plugin = plugin.replace(/const quickExpenseActivityContent = `[\s\S]*?`;/, 'const quickExpenseActivityContent = `' + escapeKotlin(qea) + '`;');

fs.writeFileSync('plugins/withAndroidShakeDetector.js', plugin);
console.log('Plugin updated successfully.');
