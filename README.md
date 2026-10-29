# Life vs Tech

A live, whole-class lesson for: *I can explain how using technology can be a distraction from other things, in both a positive and negative way.*

The teacher runs the lesson from their computer. Pairs join on their laptops with a 4-letter room code and see each slide as the teacher moves through it.

## What the teacher can do

- **Move the slides** with ◀ ▶ (or the arrow keys). Every laptop follows.
- **Freeze** (or press F) pauses every laptop. Pupils see "Screens paused" and can't type.
- **Time to listen** (or press L) flashes a full-screen message on every laptop, plays a short chime, and freezes them. Use ▾ for other messages or type your own. **Unfreeze** releases everyone.
- **Answers on laptops** lets pupils see the whole class wall, not just their own answers.
- **Click any pair** in the bar at the bottom to bring up their screen. **Show on all laptops** puts their work on every laptop.
- **Hide an answer**: hover over an answer and click 🙈.
- **⋯ menu**: add a quick question, hide pair names, turn the chime on or off, present mode, full screen, end lesson.
- **End lesson** signs everyone out and deletes all names and answers.

## The lesson (26 slides)

Teaching slides (🖼️) from the Balance Quest deck appear on every laptop as you teach them, in between the interactive parts.

1. Joining screen: The Balance Quest, the learning objective, a QR code and the room code
2. 💬 What do you use technology for that needs you to really concentrate?
3. 💬 Why do you need to pay attention to it? Can you do anything else at the same time?
4. 🖼️ Technology is like water for a growing plant
5. 📊 Do you ever lose track of time when using technology?
6. 🖼️ Why is it so hard to stop? (sticky tech)
7. 📊 Which "sticky" trick catches you out the most?
8. 💬 If a child spent all their time on an online game, what might they miss out on?
9. 📊 How do you decide what to do on a device?
10. 🖼️ The Challenge: Life vs Tech
11. 🃏 The Life and Tech cards
12–15. 🖼️ Rounds 1–4: Perfect Match, Danger Zone, Social Crash, Battery Drain
16. 🎴 **Tech vs Life** card activity (pairs are dealt cards, decide, explain why; class grid on your screen)
17. 🖼️ The Multitasking Matrix
18. 📊 Which tech activity is the most distracting?
19. ↔️ What can and can't you do at the same time as using a device?
20. 🖼️ Knowing when to unplug
21. 🖼️ The Guardrails: why age limits matter
22. ⚖️ **Positive and negative** task
23. 💬 How do you decide what is important when using technology?
24. 🖼️ Achieving digital wellbeing
25. 🖼️ Master your screen time
26. 📊 How confident are you?

Skip any slide by clicking another one in the list on the left. On an iPad held upright, the list is behind the ☰ button.

## iPads

Pupils can join on iPads: scan the QR code with the Camera app, or type the address. If an iPad goes to sleep, it reconnects by itself when it wakes up. Teachers can also run the lesson from an iPad.

## Putting it online (Cloudflare, like the Games Room)

1. **GitHub**: create a new repository (for example `life-vs-tech`). Click **uploading an existing file** and drag in everything from this folder: `wrangler.jsonc`, `README.md` and the `src` and `public` folders (the `public` folder includes `slides`, your 13 slide images). Commit.
2. **Cloudflare dashboard**: go to **Workers & Pages → Create → Import a repository**, choose `life-vs-tech` and click **Deploy**. Keep the default settings.
3. **Set your teacher code**: open the new worker, then **Settings → Variables and Secrets → Add**. Choose type **Secret**, name `TEACHER_CODE`, and enter your code. Save and deploy. Until you do this the code is `walden`.
4. Open the worker's address (something like `life-vs-tech.yourname.workers.dev`). Choose **I'm the teacher**, type the teacher code, and the room code appears on screen.

It runs on Cloudflare's free plan. Each lesson is its own room, and room data is deleted when you end the lesson, or automatically after 4 hours of no activity.

## Data

Pupils type first names only (for example "Amy & Leo"). Names and answers are held only for that lesson and then deleted. Nothing is stored on the laptops apart from a note that lets a pupil rejoin if they refresh the page.
