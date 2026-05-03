# Budget Charts

Budget Charts is a local stock chart app inspired by TradingView. It shows candles, volume, RSI/MFI, MACD, a watchlist, and live market data from Yahoo Finance.

## Open The App

If the app is already running, open this link:

http://127.0.0.1:5173

## First-Time Setup

Open PowerShell in this folder:

`C:\Users\Wong Zhen Yi\Python Applications\Budget-Charts`

Then run these commands once:

```powershell
cd backend
python -m pip install -r requirements.txt
cd ../frontend
npm install
```

## Start The App

You need two PowerShell windows.

In the first window, start the data server:

```powershell
cd "C:\Users\Wong Zhen Yi\Python Applications\Budget-Charts\backend"
python start_server.py
```

In the second window, start the chart screen:

```powershell
cd "C:\Users\Wong Zhen Yi\Python Applications\Budget-Charts\frontend"
npm run dev
```

Then open:

http://127.0.0.1:5173

## Stop The App

Close both PowerShell windows, or press `Ctrl+C` in each window.

