#!/usr/bin/env python3
"""
Scrape CMC Events Images and Create Bedrock KB Ready Metadata

This script:
1. Reads the events JSON from the API
2. Extracts image URLs for each event
3. Downloads images and creates metadata files in Bedrock KB format
4. Uses 'content_type: event' to distinguish from 'content_type: photograph' (existing photos)
"""

import json
import os
import re
import requests
from pathlib import Path
from html import unescape
from typing import Optional

# Configuration
EVENTS_JSON_PATH = Path(__file__).parent.parent / "scraped_data" / "cmc_events.json"
OUTPUT_DIR = Path(__file__).parent.parent / "scraped_data" / "bedrock_kb_ready" / "events"

def clean_html(text: str) -> str:
    """Remove HTML tags and decode entities from text."""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', ' ', text)
    # Decode HTML entities
    clean = unescape(clean)
    # Clean up whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def sanitize_filename(name: str) -> str:
    """Create a safe filename from event name."""
    # Remove special characters and replace spaces with underscores
    safe = re.sub(r'[^\w\s-]', '', name)
    safe = re.sub(r'\s+', '_', safe)
    return safe[:50]  # Limit length

def create_metadata(event: dict, image_url: str, filename: str) -> dict:
    """
    Create Bedrock KB metadata JSON in the same format as existing photographs.
    Key difference: content_type = "event" instead of "photograph"
    """
    # Clean description (remove HTML)
    description = clean_html(event.get('description', ''))
    summary = clean_html(event.get('summary', ''))
    
    # Use summary if available, otherwise truncate description
    short_desc = summary if summary else description[:500]
    
    metadata = {
        "metadataAttributes": {
            "title": {
                "value": {
                    "type": "STRING",
                    "stringValue": event.get('name', 'Unknown Event')
                },
                "includeForEmbedding": True
            },
            "event_id": {
                "value": {
                    "type": "STRING",
                    "stringValue": event.get('id', '')
                },
                "includeForEmbedding": True
            },
            "category": {
                "value": {
                    "type": "STRING",
                    "stringValue": event.get('category', '')
                },
                "includeForEmbedding": True
            },
            "description": {
                "value": {
                    "type": "STRING",
                    "stringValue": short_desc
                },
                "includeForEmbedding": True
            },
            "subtitle": {
                "value": {
                    "type": "STRING",
                    "stringValue": event.get('subtitle', '')
                },
                "includeForEmbedding": True
            },
            "event_type": {
                "value": {
                    "type": "STRING",
                    "stringValue": event.get('event_type', '')
                },
                "includeForEmbedding": True
            },
            "content_type": {
                "value": {
                    "type": "STRING",
                    "stringValue": "event"  # KEY DIFFERENTIATOR from "photograph"
                },
                "includeForEmbedding": False
            },
            "media_type": {
                "value": {
                    "type": "STRING",
                    "stringValue": "Event Image"
                },
                "includeForEmbedding": False
            },
            "source": {
                "value": {
                    "type": "STRING",
                    "stringValue": "Cincinnati Museum Center Events"
                },
                "includeForEmbedding": False
            },
            "ticket_url": {
                "value": {
                    "type": "STRING",
                    "stringValue": f"https://tickets.cincymuseum.org/cincymuseum/events/{event.get('id', '')}"
                },
                "includeForEmbedding": False
            }
        }
    }
    
    # Add release date if available
    if event.get('release_sessions_until'):
        metadata["metadataAttributes"]["available_until"] = {
            "value": {
                "type": "STRING",
                "stringValue": event.get('release_sessions_until', '')
            },
            "includeForEmbedding": True
        }
    
    return metadata

def get_image_url_for_event(event_id: str, meta_data: list) -> Optional[str]:
    """Find image URL for a specific event from the meta data."""
    for meta in meta_data:
        if meta.get('resource_id') == event_id and meta.get('metakey') == 'image_profile':
            return meta.get('value')
    return None

def download_image(url: str, output_path: Path) -> bool:
    """Download image from URL and save to output path."""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return False

def main():
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Load events JSON
    print(f"Loading events from {EVENTS_JSON_PATH}")
    with open(EVENTS_JSON_PATH, 'r') as f:
        data = json.load(f)
    
    events = data.get('event_template', {}).get('_data', [])
    meta_data = data.get('meta', {}).get('_data', [])
    
    print(f"Found {len(events)} events")
    print(f"Found {len(meta_data)} meta entries")
    
    # Track statistics
    downloaded = 0
    skipped = 0
    no_image = 0
    
    for i, event in enumerate(events, 1):
        event_id = event.get('id', '')
        event_name = event.get('name', 'Unknown')
        
        print(f"\n[{i}/{len(events)}] Processing: {event_name}")
        
        # Find image URL for this event
        image_url = get_image_url_for_event(event_id, meta_data)
        
        if not image_url:
            print(f"  No image found for event")
            no_image += 1
            continue
        
        # Create safe filename
        safe_name = sanitize_filename(event_name)
        image_filename = f"{i:03d}_{safe_name}.jpg"
        image_path = OUTPUT_DIR / image_filename
        metadata_path = OUTPUT_DIR / f"{image_filename}.metadata.json"
        
        # Check if already downloaded
        if image_path.exists() and metadata_path.exists():
            print(f"  Already exists, skipping")
            skipped += 1
            continue
        
        # Download image
        print(f"  Downloading from: {image_url}")
        if download_image(image_url, image_path):
            # Create and save metadata
            metadata = create_metadata(event, image_url, image_filename)
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"  Saved: {image_filename}")
            downloaded += 1
        else:
            print(f"  Failed to download")
    
    # Print summary
    print("\n" + "="*50)
    print("SCRAPING COMPLETE")
    print("="*50)
    print(f"Total events: {len(events)}")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped (already exists): {skipped}")
    print(f"No image available: {no_image}")
    print(f"\nOutput directory: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
