import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;700&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans Bengali',sans-serif;font-size:14pt;line-height:1.6;margin:40px} .p{page-break-after:always} h1{font-size:20pt}</style></head><body>
<div class="p"><h1>EDUCERRO TEST FIXTURE</h1><p>This document was written by the IntelliHorizon team to test the import pipeline. It is not an NCTB textbook and must never be shown to students as one.</p></div>
<div class="p"><h1>Chapter 1: How plants make food</h1><p>Photosynthesis is the process by which green plants make their own food. Plants take in carbon dioxide from the air through tiny pores called stomata, and water through their roots.</p><p>Inside the chloroplasts, a green pigment called chlorophyll captures energy from sunlight. This energy is used to turn carbon dioxide and water into glucose. Oxygen is released into the air as a by-product.</p></div>
<div class="p"><h1>Chapter 2: Force and motion</h1><p>A force is a push or a pull that can change the motion of an object. The unit of force is the newton.</p><p>When an object falls freely near the surface of the Earth, its velocity increases by about 9.8 metres per second every second. This is called the acceleration due to gravity.</p></div>
<div class="p"><h1>গাছের খাবার</h1><p>সবুজ গাছ পাতা দিয়ে খাবার তৈরি করে। এই কাজে রোদ লাগে। গাছ বাতাস থেকে বায়ু নেয়। মাটি থেকে পানি নেয়। তারপর পাতায় খাবার জমা থাকে। সব গাছের পাতা সবুজ নয়, তবে বেশির ভাগ গাছের পাতা সবুজ।</p></div><div class="p"><h1>সালোকসংশ্লেষণ</h1><p>সবুজ উদ্ভিদ সূর্যালোকের উপস্থিতিতে কার্বন ডাই-অক্সাইড ও পানি থেকে শর্করা তৈরি করে। এই প্রক্রিয়াকে সালোকসংশ্লেষণ বলে। এ সময় অক্সিজেন নির্গত হয়।</p></div>
<div class="p"><p>evsjv‡´k RvZxq wkÿvµg I cvV¨cy¯Íi †evW© Øviv cÖYxZ Ges ivóªxq gyÖYvjq KZ©„K gyw´ªZ wkÿve‡l© cvV¨cy¯ÍK evsjv‡´k RvZxq wkÿvµg</p></div>
<div><p></p></div>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: "/tmp/fixture.pdf", format: "A4" });
await b.close();
console.log("ok");
