#!/usr/bin/env python3
"""
Scrape photographs from Cincinnati Museum Center's online collection.
This script navigates the ASP.NET-based Argus collection portal.
"""

import requests
from bs4 import BeautifulSoup
import os
import json
import re
import time
from urllib.parse import urljoin

# Base URL
BASE_URL = "https://searchcollections.cincymuseum.org"
PHOTOS_URL = f"{BASE_URL}/public/museum/Portal/Combined.aspx?lang=en-US&p_AAEE=tab4&p_AAMO=tab6&d=d"

# Output directory
OUTPUT_DIR = "/Users/etloaner/Desktop/Cincinnati-Museum-Chatbot/backend/lambda/webcrawler/scraped_data/cmc_photographs"

# Session to maintain cookies
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})


def get_page_html(url):
    """Fetch a page and return its HTML."""
    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def extract_viewstate(html):
    """Extract ASP.NET ViewState and other form fields needed for postback."""
    soup = BeautifulSoup(html, 'html.parser')
    form_data = {}
    
    # Get hidden fields
    hidden_inputs = soup.find_all('input', {'type': 'hidden'})
    for inp in hidden_inputs:
        name = inp.get('name', '')
        value = inp.get('value', '')
        if name:
            form_data[name] = value
    
    return form_data


def find_photo_postback_targets(html):
    """Find the postback targets for each photo on the listing page."""
    soup = BeautifulSoup(html, 'html.parser')
    targets = []
    
    # The HTML uses &#39; for single quotes, so we need to handle that
    # Pattern: v00$v01$v00$v01$v00$v03$v00$v01$v000$v00 (first photo)
    # The v000, v001, v002... part changes for each photo
    
    # First decode HTML entities
    from html import unescape
    decoded_html = unescape(html)
    
    # Pattern to match photo click targets
    pattern = re.compile(r"__doPostBack\('([^']*\$v00\$v01\$v00\$v01\$v00\$v03\$v00\$v01\$v\d+\$v00)'")
    
    for match in pattern.finditer(decoded_html):
        target = match.group(1)
        targets.append(target)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_targets = []
    for t in targets:
        if t not in seen:
            seen.add(t)
            unique_targets.append(t)
    
    return unique_targets


def do_postback(base_html, event_target, event_argument=''):
    """Perform an ASP.NET postback."""
    form_data = extract_viewstate(base_html)
    form_data['__EVENTTARGET'] = event_target
    form_data['__EVENTARGUMENT'] = event_argument
    
    try:
        response = session.post(
            PHOTOS_URL,
            data=form_data,
            timeout=60
        )
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"Error performing postback: {e}")
        return None


def parse_photo_detail(html):
    """Parse a photo detail page to extract metadata."""
    soup = BeautifulSoup(html, 'html.parser')
    metadata = {}
    
    # Find all ViewControl spans which contain the field values
    view_controls = soup.find_all('span', class_='ViewControl')
    
    # The page structure has label-value pairs
    # Look for common patterns in the HTML
    text = soup.get_text(separator='\n')
    
    # Extract specific fields using patterns
    field_patterns = {
        'Title': r'Title\s*\n\s*([^\n]+)',
        'Collection': r'Collection\s*\n\s*([^\n]+)',
        'Image ID': r'Image ID\s*\n\s*([^\n]+)',
        'Dates': r'Dates\s*\n\s*([^\n]+)',
        'Description': r'Description\s*\n\s*([^\n]+)',
        'Dimensions': r'Dimensions\s*\n\s*([^\n]+)',
        'Record Type': r'Record Type\s*\n\s*([^\n]+)',
        'Media Type': r'Media Type\s*\n\s*([^\n]+)',
        'Subjects': r'Subjects\s*\n\s*([^\n]+)',
        'STAR Rights/Permissions': r'STAR Rights/Permissions\s*\n\s*([^\n]+)',
        'AV Formats': r'AV Formats\s*\n\s*([^\n]+)',
    }
    
    for field, pattern in field_patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            metadata[field] = match.group(1).strip()
    
    # Alternative: look for table structure with Summary Information
    summary_table = soup.find('table', class_='lc-dis-025')
    if summary_table:
        rows = summary_table.find_all('tr')
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True)
                value = cells[1].get_text(strip=True)
                if label and value:
                    metadata[label] = value
    
    # Find all images that might be the main photo
    main_images = []
    for img in soup.find_all('img'):
        src = img.get('src', '')
        if 'ViewImage.aspx' in src:
            full_url = urljoin(BASE_URL, src)
            # Skip thumbnails (they have 'template=LINK' in the URL)
            main_images.append(full_url)
    
    metadata['image_urls'] = list(set(main_images))  # Remove duplicates
    
    # Get the page title
    title_tag = soup.find('title')
    if title_tag:
        metadata['page_title'] = title_tag.get_text(strip=True)
    
    # Try to find the heading which often contains the title
    headings = soup.find_all(['h1', 'h2', 'h3'])
    for h in headings:
        text = h.get_text(strip=True)
        if text and 'Search Our Collections' not in text and 'CMC' not in text:
            if 'item_title' not in metadata:
                metadata['item_title'] = text
    
    return metadata


def download_image(url, filepath):
    """Download an image to the specified filepath."""
    try:
        response = session.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False


def extract_photo_info_from_listing(html):
    """Extract photo titles and IDs from the listing page."""
    soup = BeautifulSoup(html, 'html.parser')
    photos = []
    
    # Find photo cards - they have ViewControl spans with title and ID
    # Pattern: v000_ctl03_content for title, v000_ctl04_content for ID
    title_pattern = re.compile(r'v0*(\d+)_ctl03_content')
    id_pattern = re.compile(r'v0*(\d+)_ctl04_content')
    collection_pattern = re.compile(r'v0*(\d+)_ctl05_content')
    
    title_spans = soup.find_all('span', id=title_pattern)
    
    for span in title_spans:
        span_id = span.get('id', '')
        match = re.search(r'v0*(\d+)_ctl03', span_id)
        if match:
            index = match.group(1)
            photo_info = {
                'index': int(index),
                'title': span.get_text(strip=True)
            }
            
            # Find corresponding ID
            id_span_id = span_id.replace('_ctl03_content', '_ctl04_content')
            id_span = soup.find('span', id=id_span_id)
            if id_span:
                photo_info['image_id'] = id_span.get_text(strip=True)
            
            # Find corresponding collection
            coll_span_id = span_id.replace('_ctl03_content', '_ctl05_content')
            coll_span = soup.find('span', id=coll_span_id)
            if coll_span:
                photo_info['collection'] = coll_span.get_text(strip=True)
            
            photos.append(photo_info)
    
    return photos


def scrape_photos(num_photos=5):
    """Main function to scrape photos."""
    print(f"🔍 Starting to scrape {num_photos} photographs from CMC collection...")
    
    # Create output directories
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    images_dir = os.path.join(OUTPUT_DIR, "images")
    os.makedirs(images_dir, exist_ok=True)
    
    # Get the initial listing page
    print("📄 Fetching photo listing page...")
    html = get_page_html(PHOTOS_URL)
    if not html:
        print("❌ Failed to fetch listing page")
        return
    
    # Save the raw HTML for debugging
    with open(os.path.join(OUTPUT_DIR, "listing_page.html"), 'w', encoding='utf-8') as f:
        f.write(html)
    print("💾 Saved listing page HTML")
    
    # Extract photo info from listing
    listing_photos = extract_photo_info_from_listing(html)
    print(f"📷 Found {len(listing_photos)} photos on the listing page:")
    for p in listing_photos[:5]:
        print(f"   - {p.get('title', 'Unknown')} ({p.get('image_id', 'No ID')})")
    
    # Find postback targets for clicking on photos
    postback_targets = find_photo_postback_targets(html)
    print(f"🔗 Found {len(postback_targets)} clickable photo targets")
    
    # Scrape individual photos
    all_metadata = []
    
    for i in range(min(num_photos, len(postback_targets))):
        print(f"\n{'='*60}")
        print(f"📸 Photo {i+1}/{num_photos}")
        
        if i < len(listing_photos):
            print(f"   Title: {listing_photos[i].get('title', 'Unknown')}")
            print(f"   ID: {listing_photos[i].get('image_id', 'Unknown')}")
        
        # Click on the photo to get detail page
        target = postback_targets[i]
        print(f"🖱️  Navigating to detail page...")
        
        detail_html = do_postback(html, target)
        
        if detail_html:
            # Save detail page HTML
            detail_path = os.path.join(OUTPUT_DIR, f"detail_{i+1}.html")
            with open(detail_path, 'w', encoding='utf-8') as f:
                f.write(detail_html)
            
            # Parse metadata
            metadata = parse_photo_detail(detail_html)
            
            # Merge with listing info
            if i < len(listing_photos):
                for key, value in listing_photos[i].items():
                    if key not in metadata or not metadata[key]:
                        metadata[key] = value
            
            metadata['scrape_index'] = i + 1
            
            print(f"\n📋 Metadata extracted:")
            for key, value in metadata.items():
                if key != 'image_urls':
                    display_value = str(value)[:80] + '...' if len(str(value)) > 80 else value
                    print(f"   {key}: {display_value}")
            
            # Download the main image
            if metadata.get('image_urls'):
                print(f"\n🖼️  Found {len(metadata['image_urls'])} image(s)")
                # Prefer DerImage (full size) over zThumbnail
                img_url = None
                for url in metadata['image_urls']:
                    if 'DerImage' in url:
                        img_url = url
                        break
                if not img_url:
                    img_url = metadata['image_urls'][0]
                
                # Create filename from title or ID
                safe_title = re.sub(r'[^\w\s-]', '', metadata.get('title', metadata.get('Title', f'photo_{i+1}')))
                safe_title = safe_title[:50].strip().replace(' ', '_')
                filename = f"{i+1:03d}_{safe_title}.jpg"
                filepath = os.path.join(images_dir, filename)
                
                print(f"⬇️  Downloading image...")
                if download_image(img_url, filepath):
                    print(f"✅ Saved: {filename}")
                    metadata['local_image'] = filename
                else:
                    print(f"❌ Failed to download image")
            
            all_metadata.append(metadata)
            
            # Be nice to the server
            time.sleep(1.5)
        else:
            print(f"❌ Failed to load detail page")
    
    # Save all metadata
    metadata_path = os.path.join(OUTPUT_DIR, "all_metadata.json")
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(all_metadata, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*60}")
    print(f"✅ Complete! Scraped {len(all_metadata)} photos")
    print(f"📁 Output saved to: {OUTPUT_DIR}")
    print(f"   - images/: Downloaded photographs")
    print(f"   - all_metadata.json: Combined metadata")
    print(f"   - detail_*.html: Individual detail pages")


if __name__ == "__main__":
    scrape_photos(num_photos=50)
