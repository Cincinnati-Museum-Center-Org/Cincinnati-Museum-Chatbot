# User Guide

This guide provides step-by-step instructions for using the Cincinnati Museum Chatbot.

---

## Prerequisites

**Please ensure the application is deployed before proceeding.** 

See the [Deployment Guide](./deploymentGuide.md) for deployment instructions.

---

## Introduction

The Cincinnati Museum Chatbot is an AI-powered conversational assistant that helps visitors learn about the Cincinnati Museum Center. It provides information about exhibits, events, tickets, membership, and museum history using Amazon Bedrock's Knowledge Base technology.

The chatbot is designed to provide accurate, sourced responses with citations from official museum content, making it easy for visitors to plan their visit and explore the museum's offerings.

### Key Features
- **Streaming AI Responses**: Real-time text streaming for natural conversation flow
- **Bilingual Support**: Available in English and Spanish
- **Source Citations**: Every response includes clickable sources for verification
- **Media Previews**: View images and documents directly in the chat
- **Feedback System**: Rate responses to help improve the chatbot
- **Contact Support**: Built-in form to reach museum staff for complex inquiries

---

## Getting Started

### Step 1: Access the Application

Navigate to the application URL provided after deployment (the Amplify App URL).

**Example**: `https://master.xxxxxxxxxx.amplifyapp.com`

When you first open the chatbot, you'll see:
- The Cincinnati Museum Center logo and branding
- A welcome message explaining what the chatbot can help with
- Quick action buttons for common questions
- A language toggle (English/Spanish) in the header

---

### Step 2: Choose Your Language

The chatbot supports both English and Spanish. To switch languages:

1. Look for the language toggle in the top-right corner of the header
2. Click **EN** for English or **ES** for Spanish
3. If you have an active conversation, you'll be asked to confirm (switching clears chat history)

> **Note**: The chatbot will respond in your selected language, and all UI text will update accordingly.

---

### Step 3: Start a Conversation

You can start a conversation in two ways:

**Option A: Use Quick Actions**
Click one of the quick action buttons:
- 📍 **Plan Your Visit** - Get directions, hours, and parking info
- 🕐 **Current Exhibits** - Learn about what's on display
- 🎟️ **Tickets & Membership** - Pricing and membership benefits
- 📚 **Collections** - Explore the museum's collections
- 👥 **Group Visits** - Information for school and group tours
- ❤️ **Support the Museum** - Donation and volunteer opportunities

**Option B: Type Your Question**
Use the input field at the bottom of the screen to type any question, then press Enter or click the send button.

**Example questions:**
- "What are the museum hours?"
- "Tell me about the dinosaur exhibit"
- "How much do tickets cost for a family of four?"
- "Is there parking available?"

---

### Step 4: View the Response

As the chatbot responds, you'll see:

1. **Streaming Text**: The response appears word-by-word in real-time
2. **Typing Indicator**: Three animated dots show the bot is thinking
3. **Complete Response**: Full answer with formatted text (lists, links, etc.)

---

### Step 5: Explore Citations and Sources

After each response, you'll see a **Sources** section with citations:

**Types of Sources:**
- **🖼️ Images**: Thumbnail previews of museum photos (click to enlarge)
- **📄 PDFs**: Document previews (click to view in modal)
- **🔗 Web Links**: Links to official museum web pages

**To view a source:**
1. Click on any citation card to expand it
2. For images: Click to open a full-size modal view
3. For web links: Click to open the source page in a new tab

---

### Step 6: Provide Feedback

Help improve the chatbot by rating responses:

1. Look for the **👍** and **👎** buttons below each response
2. Click thumbs up if the answer was helpful
3. Click thumbs down if the answer was incorrect or unhelpful

Your feedback helps the museum team identify areas for improvement.

---

### Step 7: Contact Support (Optional)

For questions the chatbot can't answer, use the support feature:

1. Click the **✉️ mail icon** in the header
2. Fill out the support form:
   - First Name
   - Last Name  
   - Email Address
   - Phone Number (optional)
   - Your Question
3. Click **Submit**

A museum staff member will follow up via email.

---

## Common Use Cases

### Use Case 1: Planning a Family Visit

Get all the information you need to plan a day at the museum with your family.

**Steps:**
1. Click the **"Plan Your Visit"** quick action
2. Ask follow-up questions like:
   - "What time does the museum open on Saturday?"
   - "Is there a cafe or restaurant?"
   - "Are strollers allowed?"
3. Review the cited sources for official information

---

### Use Case 2: Learning About Current Exhibits

Discover what's currently on display at the museum.

**Steps:**
1. Click the **"Current Exhibits"** quick action
2. Ask about specific exhibits:
   - "Tell me more about the dinosaur hall"
   - "What's in the Cincinnati History Museum?"
   - "Are there any special traveling exhibits?"
3. Click on image citations to see exhibit photos

---

### Use Case 3: Purchasing Tickets and Membership

Get pricing information and membership benefits.

**Steps:**
1. Click the **"Tickets & Membership"** quick action
2. Ask specific questions:
   - "How much are tickets for 2 adults and 2 children?"
   - "What are the membership levels?"
   - "Do members get free parking?"
3. Follow the web links in citations to purchase online

---

### Use Case 4: Arranging a Group Visit

Plan a field trip or group outing.

**Steps:**
1. Click the **"Group Visits"** quick action
2. Ask about group options:
   - "How do I book a school field trip?"
   - "What's the minimum group size?"
   - "Are there educational programs available?"
3. Use the support form to contact the group sales team

---

## Tips and Best Practices

- **Be Specific**: The more specific your question, the better the answer. "What are the hours on Christmas Eve?" works better than "When are you open?"
- **Ask Follow-ups**: The chatbot maintains conversation context, so you can ask follow-up questions naturally
- **Check Citations**: Always verify important information (like prices or hours) by clicking the source links
- **Use Quick Actions**: The quick action buttons are optimized to get you the most relevant information quickly
- **Try Both Languages**: If you're bilingual, try asking in Spanish for a different perspective on the content

---

## Frequently Asked Questions (FAQ)

### Q: How accurate is the chatbot's information?
**A:** The chatbot pulls information directly from official Cincinnati Museum Center sources including the website, brochures, and curated content. However, always verify time-sensitive information (hours, prices, events) by checking the cited sources or contacting the museum directly.

### Q: Can I book tickets through the chatbot?
**A:** The chatbot cannot process transactions directly, but it will provide links to the official ticketing pages where you can complete your purchase.

### Q: Why did the chatbot say it doesn't know something?
**A:** The chatbot only answers questions based on information in its knowledge base. If it doesn't have information about something, it will let you know. Use the support form to reach a staff member for questions outside the chatbot's knowledge.

### Q: Is my conversation private?
**A:** Conversations are stored for analytics and improvement purposes. Personal information submitted through the support form is handled according to the museum's privacy policy.

### Q: How do I report an incorrect answer?
**A:** Use the thumbs down (👎) button to flag unhelpful or incorrect responses. This feedback helps the team improve the chatbot.

### Q: Can I continue a conversation later?
**A:** Conversations are maintained during your browser session. If you close the browser or switch languages, the conversation history will be cleared.

---

## Troubleshooting

### Issue: The chatbot is not responding
**Solution:** 
- Check your internet connection
- Try refreshing the page
- Clear your browser cache and try again
- If the issue persists, the service may be temporarily unavailable

### Issue: Responses are very slow
**Solution:**
- Streaming responses may take a few seconds to start, especially for complex questions
- Check your internet connection speed
- Try a simpler question to test

### Issue: Citations are not loading
**Solution:**
- Some images may take time to load depending on your connection
- Try clicking the citation card to expand it
- Web links will open in a new tab - ensure pop-ups are not blocked

### Issue: Language switch isn't working
**Solution:**
- Confirm the language change in the modal dialog
- Note that switching languages clears your conversation history
- If the UI doesn't update, try refreshing the page

### Issue: Support form submission failed
**Solution:**
- Ensure all required fields are filled out
- Check that your email address is valid
- Try again in a few moments

---

## Admin Dashboard (Staff Only)

Museum staff can access the admin dashboard to view analytics and conversation history.

### Accessing the Dashboard

1. Navigate to `/admin` on the application URL
2. Sign in with your Cognito credentials
3. You'll be redirected to the dashboard

### Dashboard Features

- **Statistics Overview**: Total conversations, feedback rates, response times
- **Conversations Tab**: Browse and filter all chatbot conversations
- **Users Tab**: View registered support requests
- **Date Range Selector**: Filter data by custom date ranges

### Viewing Conversation Details

1. Go to the **Conversations** tab
2. Click on any conversation row to view full details
3. See the complete question, answer, and citations
4. Filter by feedback type (positive, negative, none)

---

## Getting Help

If you encounter issues not covered in this guide:

- **For visitors**: Use the support form (✉️ icon) to contact museum staff
- **For technical issues**: Contact your system administrator
- **For developers**: See the [Modification Guide](./modificationGuide.md)

---

## Next Steps

- Explore the [API Documentation](./APIDoc.md) for programmatic access
- Check the [Architecture Deep Dive](./architectureDeepDive.md) to understand how the system works
- See the [Modification Guide](./modificationGuide.md) if you want to customize the application

