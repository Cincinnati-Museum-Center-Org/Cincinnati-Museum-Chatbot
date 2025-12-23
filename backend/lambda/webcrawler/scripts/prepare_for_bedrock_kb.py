#!/usr/bin/env python3
"""
Post-process scraped CMC photographs for AWS Bedrock Knowledge Base.

This script takes the scraped metadata and images and prepares them for upload to S3
in a format compatible with Bedrock Knowledge Base.

Two output formats are created:
1. Metadata files (.metadata.json) - For Bedrock KB metadata filtering
2. Markdown files (.md) - For RAG text content with embedded image references

Based on AWS Documentation:
https://docs.aws.amazon.com/bedrock/latest/userguide/s3-data-source-connector.html
https://docs.aws.amazon.com/bedrock/latest/userguide/kb-metadata.html
"""

import os
import json
import shutil
from datetime import datetime

# Paths
SCRAPED_DATA_DIR = "/Users/etloaner/Desktop/Cincinnati-Museum-Chatbot/backend/lambda/webcrawler/scraped_data/cmc_photographs"
OUTPUT_DIR = "/Users/etloaner/Desktop/Cincinnati-Museum-Chatbot/backend/lambda/webcrawler/scraped_data/bedrock_kb_ready"


def load_scraped_metadata():
    """Load the scraped metadata JSON file."""
    metadata_path = os.path.join(SCRAPED_DATA_DIR, "all_metadata.json")
    with open(metadata_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def create_bedrock_metadata_file(photo_metadata, image_filename):
    """
    Create a .metadata.json file for Bedrock Knowledge Base.
    
    Format based on AWS docs:
    https://docs.aws.amazon.com/bedrock/latest/userguide/s3-data-source-connector.html
    
    The metadata file enables filtering during retrieval queries.
    """
    metadata = {
        "metadataAttributes": {
            "title": {
                "value": {
                    "type": "STRING",
                    "stringValue": photo_metadata.get('title', photo_metadata.get('Title', 'Unknown'))
                },
                "includeForEmbedding": True
            },
            "image_id": {
                "value": {
                    "type": "STRING",
                    "stringValue": photo_metadata.get('image_id', photo_metadata.get('Image ID', ''))
                },
                "includeForEmbedding": True
            },
            "collection": {
                "value": {
                    "type": "STRING",
                    "stringValue": photo_metadata.get('collection', photo_metadata.get('Collection', ''))
                },
                "includeForEmbedding": True
            },
            "dates": {
                "value": {
                    "type": "STRING",
                    "stringValue": photo_metadata.get('Dates', '')
                },
                "includeForEmbedding": True
            },
            "subjects": {
                "value": {
                    "type": "STRING",
                    "stringValue": photo_metadata.get('Subjects', '')
                },
                "includeForEmbedding": True
            },
            "media_type": {
                "value": {
                    "type": "STRING",
                    "stringValue": photo_metadata.get('Media Type', 'Photograph')
                },
                "includeForEmbedding": False
            },
            "source": {
                "value": {
                    "type": "STRING",
                    "stringValue": "Cincinnati Museum Center"
                },
                "includeForEmbedding": False
            }
        }
    }
    
    return metadata


def create_markdown_content(photo_metadata, image_filename):
    """
    Create a markdown file with the photo metadata as searchable text content.
    
    This approach is better for RAG because:
    1. The text content becomes part of the vector embeddings
    2. Users can search by any field in natural language
    3. The LLM can reference the full context when generating responses
    """
    title = photo_metadata.get('title', photo_metadata.get('Title', 'Unknown'))
    image_id = photo_metadata.get('image_id', photo_metadata.get('Image ID', ''))
    collection = photo_metadata.get('collection', photo_metadata.get('Collection', ''))
    dates = photo_metadata.get('Dates', '')
    description = photo_metadata.get('Description', '')
    dimensions = photo_metadata.get('Dimensions', '')
    media_type = photo_metadata.get('Media Type', '')
    subjects = photo_metadata.get('Subjects', '')
    av_formats = photo_metadata.get('AV Formats', '')
    rights = photo_metadata.get('STAR Rights/Permissions', '')
    
    markdown = f"""# {title}

## Cincinnati Museum Center - Photograph Collection

![{title}]({image_filename})

### Summary Information

| Field | Value |
|-------|-------|
| **Title** | {title} |
| **Image ID** | {image_id} |
| **Collection** | {collection} |
| **Date** | {dates} |
| **Dimensions** | {dimensions} |
| **Media Type** | {media_type} |
| **Format** | {av_formats} |

### Description

{description}

### Subjects

{subjects}

### Rights & Permissions

{rights}

---
*Source: Cincinnati Museum Center Online Collection*
*Image ID: {image_id}*
"""
    
    return markdown


def create_combined_csv(all_metadata):
    """
    Create a CSV file with all metadata for bulk processing.
    
    Bedrock KB can parse CSV files and treat columns as metadata fields.
    This is efficient for large datasets.
    """
    import csv
    
    csv_path = os.path.join(OUTPUT_DIR, "all_photographs.csv")
    
    # Define columns
    columns = [
        'title', 'image_id', 'collection', 'dates', 'description',
        'dimensions', 'media_type', 'subjects', 'av_formats', 
        'rights', 'image_filename', 'source'
    ]
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        
        for photo in all_metadata:
            row = {
                'title': photo.get('title', photo.get('Title', '')),
                'image_id': photo.get('image_id', photo.get('Image ID', '')),
                'collection': photo.get('collection', photo.get('Collection', '')),
                'dates': photo.get('Dates', ''),
                'description': photo.get('Description', ''),
                'dimensions': photo.get('Dimensions', ''),
                'media_type': photo.get('Media Type', ''),
                'subjects': photo.get('Subjects', ''),
                'av_formats': photo.get('AV Formats', ''),
                'rights': photo.get('STAR Rights/Permissions', ''),
                'image_filename': photo.get('local_image', ''),
                'source': 'Cincinnati Museum Center'
            }
            writer.writerow(row)
    
    # Create the CSV metadata file for Bedrock KB
    csv_metadata = {
        "metadataAttributes": {
            "source": {
                "value": {
                    "type": "STRING",
                    "stringValue": "Cincinnati Museum Center Photograph Collection"
                },
                "includeForEmbedding": False
            }
        },
        "documentStructureConfiguration": {
            "type": "RECORD_BASED_STRUCTURE_METADATA",
            "recordBasedStructureMetadata": {
                "contentFields": [
                    {"fieldName": "description"}
                ],
                "metadataFieldsSpecification": {
                    "fieldsToInclude": [
                        {"fieldName": "title"},
                        {"fieldName": "image_id"},
                        {"fieldName": "collection"},
                        {"fieldName": "dates"},
                        {"fieldName": "subjects"},
                        {"fieldName": "media_type"}
                    ]
                }
            }
        }
    }
    
    csv_metadata_path = os.path.join(OUTPUT_DIR, "all_photographs.csv.metadata.json")
    with open(csv_metadata_path, 'w', encoding='utf-8') as f:
        json.dump(csv_metadata, f, indent=2)
    
    return csv_path


def prepare_for_bedrock_kb():
    """Main function to prepare all files for Bedrock Knowledge Base."""
    
    print("🚀 Preparing scraped data for AWS Bedrock Knowledge Base...")
    print(f"📂 Input: {SCRAPED_DATA_DIR}")
    print(f"📂 Output: {OUTPUT_DIR}")
    
    # Create output directories
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    images_dir = os.path.join(OUTPUT_DIR, "images")
    markdown_dir = os.path.join(OUTPUT_DIR, "markdown")
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(markdown_dir, exist_ok=True)
    
    # Load scraped metadata
    all_metadata = load_scraped_metadata()
    print(f"📷 Processing {len(all_metadata)} photographs...")
    
    processed_count = 0
    
    for photo in all_metadata:
        local_image = photo.get('local_image')
        if not local_image:
            continue
        
        # Source and destination paths
        src_image_path = os.path.join(SCRAPED_DATA_DIR, "images", local_image)
        if not os.path.exists(src_image_path):
            print(f"⚠️  Image not found: {local_image}")
            continue
        
        # Get base filename without extension
        base_name = os.path.splitext(local_image)[0]
        
        # 1. Copy image to output directory
        dst_image_path = os.path.join(images_dir, local_image)
        shutil.copy2(src_image_path, dst_image_path)
        
        # 2. Create .metadata.json file for the image
        metadata_content = create_bedrock_metadata_file(photo, local_image)
        metadata_path = os.path.join(images_dir, f"{local_image}.metadata.json")
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata_content, f, indent=2)
        
        # 3. Create markdown file with full content
        markdown_content = create_markdown_content(photo, f"../images/{local_image}")
        markdown_path = os.path.join(markdown_dir, f"{base_name}.md")
        with open(markdown_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        # 4. Create .metadata.json for the markdown file too
        md_metadata_path = os.path.join(markdown_dir, f"{base_name}.md.metadata.json")
        with open(md_metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata_content, f, indent=2)
        
        processed_count += 1
    
    # 5. Create combined CSV file
    csv_path = create_combined_csv(all_metadata)
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"✅ Complete! Prepared {processed_count} photographs for Bedrock KB")
    print(f"\n📁 Output structure:")
    print(f"   {OUTPUT_DIR}/")
    print(f"   ├── images/                    # Images + metadata files")
    print(f"   │   ├── *.jpg                  # Original images")
    print(f"   │   └── *.jpg.metadata.json    # Bedrock KB metadata")
    print(f"   ├── markdown/                  # Rich text content")
    print(f"   │   ├── *.md                   # Searchable markdown")
    print(f"   │   └── *.md.metadata.json     # Bedrock KB metadata")
    print(f"   ├── all_photographs.csv        # Combined CSV")
    print(f"   └── all_photographs.csv.metadata.json")
    
    print(f"\n📤 To upload to S3:")
    print(f"   aws s3 sync {OUTPUT_DIR} s3://YOUR-BUCKET/cmc-photographs/")
    
    print(f"\n💡 Recommended Bedrock KB setup:")
    print(f"   1. Use the 'markdown/' folder as your data source for best RAG results")
    print(f"   2. The markdown files contain searchable text + image references")
    print(f"   3. Metadata enables filtering by collection, date, subjects, etc.")
    print(f"   4. Alternatively, use 'all_photographs.csv' for structured data")


if __name__ == "__main__":
    prepare_for_bedrock_kb()




