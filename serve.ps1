param([int]$Port = 5173)

$root = $PSScriptRoot

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.mjs'  = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.mp3'  = 'audio/mpeg'
    '.ogg'  = 'audio/ogg'
    '.wav'  = 'audio/wav'
    '.glb'  = 'model/gltf-binary'
    '.gltf' = 'model/gltf+json'
}

try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://+:$Port/")
    $listener.Start()
    Write-Host "Serving $root on http://localhost:$Port/"
    [Console]::Out.Flush()
} catch {
    # Try localhost only
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$Port/")
        $listener.Start()
        Write-Host "Serving $root on http://localhost:$Port/"
        [Console]::Out.Flush()
    } catch {
        Write-Host "ERROR: Could not bind port $Port - $_"
        exit 1
    }
}

while ($true) {
    try {
        $ctx = $listener.GetContext()
    } catch {
        Write-Host "Listener stopped: $_"
        break
    }

    $req = $ctx.Request
    $res = $ctx.Response

    try {
        $urlPath = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
        if ($urlPath -eq '/') { $urlPath = '/index.html' }

        $rel = $urlPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $root $rel

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $res.StatusCode = 200
            $res.ContentType = $mime
            $res.ContentLength64 = $bytes.Length
            $res.Headers.Add('Access-Control-Allow-Origin', '*')
            $res.Headers.Add('Cache-Control', 'no-cache')
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $indexPath = Join-Path $root 'index.html'
            if (Test-Path $indexPath) {
                $bytes = [System.IO.File]::ReadAllBytes($indexPath)
                $res.StatusCode = 200
                $res.ContentType = 'text/html; charset=utf-8'
                $res.ContentLength64 = $bytes.Length
                $res.Headers.Add('Access-Control-Allow-Origin', '*')
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
                $res.ContentLength64 = $msg.Length
                $res.OutputStream.Write($msg, 0, $msg.Length)
            }
        }
    } catch {
        Write-Host "Request error: $_"
        try { $res.StatusCode = 500 } catch {}
    } finally {
        try { $res.Close() } catch {}
    }
}

$listener.Close()
