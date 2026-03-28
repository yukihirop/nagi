---
name: youtube-analytics
description: Analyze YouTube channels and videos using the YouTube Data API v3. Creates a Jupyter notebook with visualizations, converts to HTML, and deploys to Vercel. Use when the user says "YouTube分析", "YouTube analytics", "チャンネル分析", "動画分析", "YouTubeの分析", "analyze YouTube", "YouTube stats", or asks to analyze a YouTube channel or video performance.
---

# YouTube Analytics

Analyze YouTube channels and videos using the YouTube Data API v3, generate a notebook report with visualizations, and deploy to Vercel.

## Prerequisites

- `YOUTUBE_API_KEY` environment variable must be set (YouTube Data API v3 key from GCP)
- If not set, inform the user and stop

## Step 1: Identify the Target

Ask or infer from the user's message:
- **Channel**: by name, handle (@handle), or channel ID
- **Specific videos**: by URL or title
- **Analysis focus**: general overview, trends, engagement, comparison, etc.

## Step 2: Fetch Data via YouTube Data API v3

Use Python's `urllib.request` and `json` modules (no external HTTP libraries needed).

**Base URL:** `https://www.googleapis.com/youtube/v3`

**Common endpoints:**

### Find Channel ID (if user gives name/handle)
```python
import urllib.request, json, os
API_KEY = os.environ['YOUTUBE_API_KEY']

# Search for channel
url = f'https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q={query}&key={API_KEY}'
data = json.loads(urllib.request.urlopen(url).read())
channel_id = data['items'][0]['snippet']['channelId']
```

### Channel Statistics
```python
url = f'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&id={channel_id}&key={API_KEY}'
```

### List Videos (via playlist — uploads playlist)
```python
# Get uploads playlist ID from channel's contentDetails.relatedPlaylists.uploads
url = f'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId={uploads_playlist_id}&maxResults=50&key={API_KEY}'
```

### Video Statistics (batch up to 50 IDs)
```python
video_ids = ','.join(ids)
url = f'https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id={video_ids}&key={API_KEY}'
```

**Quota tips:**
- YouTube Data API v3 has a daily quota of 10,000 units
- search.list costs 100 units; most other calls cost 1 unit
- Minimize search calls. Prefer channels.list and playlistItems.list
- Batch video IDs (up to 50 per request) to reduce calls
- For large channels, limit to the most recent 100-200 videos

## Step 3: Create the Notebook

Use the `NotebookEdit` tool to create an `.ipynb` file. Set kernel to `python3`.

**Recommended notebook structure:**

1. **Title & Overview** (markdown): Channel name, subscriber count, total views, video count
2. **Data Fetching** (code): API calls to collect video data into a pandas DataFrame
3. **Views Distribution** (code+viz): Histogram or box plot of view counts
4. **Top Videos** (code+viz): Bar chart of top 10/20 videos by views
5. **Engagement Analysis** (code+viz): Like rate (likes/views), comment rate
6. **Publishing Trends** (code+viz): Videos per month/year, day-of-week patterns
7. **Performance Over Time** (code+viz): Views vs publish date scatter/line
8. **Summary** (markdown): Key findings and insights

**Matplotlib setup:** Always include this in the setup cell:
```python
import matplotlib
matplotlib.rcParams['font.family'] = 'Noto Sans CJK JP'  # Japanese font support
```
Use the default matplotlib style (white background, black text). Do NOT use dark themes — they are hard to read in notebook HTML output.

Adapt the structure based on the user's specific request. For example:
- Channel comparison → side-by-side metrics
- Single video deep dive → engagement metrics, related videos
- Trend analysis → time series focus

## Step 4: Execute the Notebook

```bash
jupyter nbconvert --to notebook --execute --inplace <notebook-file>.ipynb
```

Do NOT use `jupyter execute` as it may not persist outputs to the file.

If execution fails due to API errors:
1. Check if `YOUTUBE_API_KEY` is set
2. Check quota limits (may need to reduce data fetched)
3. Fix and retry up to 2 times

## Step 5: Convert to HTML

```bash
jupyter nbconvert --to html --template classic <notebook-file>.ipynb
```

Always use `--template classic` for standalone HTML that renders correctly outside JupyterLab.

By default, code cells are shown (notebook style with `In [n]:` prompts). If the user explicitly asks to hide the code, add `--no-input`.

## Step 6: Deploy to Vercel

Read the HTML file, then deploy:

```
mcp__vercel__vercel_deploy({
  name: "youtube-<channel-slug>",
  files: [
    { file: "index.html", data: "<the full HTML content>" }
  ]
})
```

## Step 7: Return Result

Respond with:
1. The deployed URL
2. Key findings (subscriber count, average views, top video, etc.)
3. Any data limitations (quota, private videos, etc.)

Example:
```
YouTube分析レポートをデプロイしました！

URL: https://youtube-hikakin-xxx.vercel.app

HikakinTVの分析結果:
- チャンネル登録者数: 1,100万人
- 総動画数: 3,200本（直近200本を分析）
- 平均再生回数: 150万回
- 最も再生された動画: 「○○○」（5,000万回）
- いいね率平均: 4.2%
- 投稿頻度: 週3-4本（木・金が多い）
```
