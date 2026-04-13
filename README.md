# Bean Physics

A browser sandbox where coffee beans bounce, collide, transfer energy, and visually roast over time.

## Project Purpose

`Bean Physics` is designed as a playful roast simulator:
- Spawn beans into a 2D world.
- Let collisions transfer impact energy.
- Convert accumulated energy into roast color changes.
- Visualize roast quality with live analytics.

## How It Works

The app uses a Matter.js runtime (`physics.js`) with custom rendering and analytics:
- Matter handles body dynamics, collision solving, and boundaries.
- A custom canvas renderer draws stylized bean paths and roast colors.
- Collision impact adds roast energy (`totalForce`) per bean.
- Colors transition smoothly through roast stages as energy increases.

## Roast Analytics HUD

The HUD tracks:
- Total roast energy
- Average bean color
- Roast consistency percentage
- Color distribution histogram (real roast palette colors)
- Energy-over-time curve (roast curve proxy)

## Controls

- Hold **Make bean** to continuously stream beans into the world.
- Left-click and drag to push beans with stronger directional interaction.
- Toggle **Debug: ON/OFF** to show debug hit circles.
- On supported mobile devices:
  - Tilt affects bean motion.
  - Shake applies an impulse burst.
  - iOS requires explicit motion permission.

## Project Structure

- `index.html` - canvas and control elements.
- `physics.js` - Matter.js simulation, rendering, input, analytics, and bootstrapping.
- `styles.css` - layout and control styling.
- `script.js` - inactive legacy experiment (not loaded by `index.html`).
- `test.js` - empty placeholder file.

## Setup

No build step is required.

1. Clone repo:
   - `git clone https://github.com/naddot/bean-physics`
2. Open folder:
   - `cd bean-physics`
3. Run a local server:
   - `python -m http.server 8000`
4. Open:
   - `http://127.0.0.1:8000`

PowerShell example:
- `python -m http.server 8000`

## Dependencies

- Browser with Canvas and ES6 support
- Matter.js (loaded from CDN in `index.html`)
- Optional: Python 3 for local static serving

## Tuning Constants

Most simulation tuning lives in the `CONFIG` object at the top of `physics.js`:
- `CONFIG.physics` for gravity/solver/world bounds
- `CONFIG.bean` for mass-like feel, drag, bounce, spawn velocity
- `CONFIG.mouse` for interaction strength
- `CONFIG.motion` for tilt and shake response
- `CONFIG.analytics` for histogram/curve sampling
- `CONFIG.roastThresholds` and `CONFIG.roastColors` for roast progression

## Usage Examples

- Click once on **Make bean** to add a single bean.
- Hold **Make bean** to continuously stream beans.
- Left-click and drag through beans to inject momentum and increase roast energy quickly.
- Use **Debug: ON** while tuning values in `CONFIG`.

## Deployment Steps

### GitHub Pages

1. Push to GitHub.
2. Enable Pages from branch root.
3. Use the generated site URL.

### Google Cloud Storage Static Hosting

1. Create a bucket in project `bqsqltesting`.
2. Upload `index.html`, `physics.js`, and `styles.css`.
3. Configure bucket website entrypoint (`index.html`).
4. Grant `Storage Object Viewer` to `allUsers` if hosting publicly.

Required API:
- Cloud Storage API

Required IAM role:
- `roles/storage.admin` for deploy user/service account

No secrets or backend service accounts are required for this static frontend app.

## Assumptions

- `physics.js` is the single active runtime.
- Matter.js CDN is reachable at runtime.
- The app remains frontend-only (no backend state or persistence).

## Known Limitations

- No persistence of roast sessions.
- Very high bean counts will reduce frame rate.
- Mobile motion behavior varies by browser/device sensor quality.

## Troubleshooting

- If the page is blank, confirm `matter.min.js` is loading (network/CDN access).
- If motion controls do not work on iOS, tap **Enable Motion** and grant permission.
- If updates do not appear, hard refresh the page (`Ctrl+F5`).

