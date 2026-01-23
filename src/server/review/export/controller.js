import puppeteer from 'puppeteer'
import * as cheerio from 'cheerio'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType
} from 'docx'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Parse HTML review content into structured data for Word export
 */
function parseReviewContent(htmlContent) {
  if (!htmlContent) {
    return {
      summary: [],
      reviewedContent: null,
      improvements: []
    }
  }

  const $ = cheerio.load(htmlContent)
  const parsed = {
    summary: [],
    reviewedContent: null,
    improvements: []
  }

  // Parse Content Quality Summary
  $('.review-summary .score-item').each((i, elem) => {
    const categoryName = $(elem).find('.category-name').text().trim()
    const categoryScore = $(elem).find('.category-score').text().trim()
    const categoryNote = $(elem).find('.category-note').text().trim()

    // Get score level from class (score-1 to score-5)
    const scoreClass = $(elem).attr('class')
    const scoreMatch = scoreClass ? scoreClass.match(/score-(\d)/) : null
    const scoreLevel = scoreMatch ? parseInt(scoreMatch[1]) : 3

    parsed.summary.push({
      category: categoryName,
      score: categoryScore,
      note: categoryNote,
      scoreLevel
    })
  })

  // Parse Reviewed Content - extract text while removing HTML
  const reviewedContentElem = $('.reviewed-content .content-body')
  if (reviewedContentElem.length) {
    parsed.reviewedContent = reviewedContentElem.text().trim()
  }

  // Parse Top 5 Improvements
  $('.example-improvements .improvement-item').each((i, elem) => {
    const title = $(elem).find('.issue-title').text().trim()
    const description = $(elem).find('.issue-description').text().trim()
    const beforeText = $(elem)
      .find('.before-text')
      .text()
      .replace('Current:', '')
      .trim()
    const afterText = $(elem)
      .find('.after-text')
      .text()
      .replace('Suggested:', '')
      .trim()

    // Get severity class
    const itemClass = $(elem).attr('class')
    const severityMatch = itemClass
      ? itemClass.match(/severity-(critical|high|medium|low)/)
      : null
    const severity = severityMatch ? severityMatch[1] : 'medium'

    parsed.improvements.push({
      title,
      description,
      before: beforeText,
      after: afterText,
      severity
    })
  })

  return parsed
}

/**
 * Fetch review results from backend API
 */
async function fetchReviewResults(id, request) {
  try {
    const config = request.server.app.config
    const backendUrl = config.get('backendUrl')

    const response = await fetch(`${backendUrl}/api/results/${id}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch review results: ${response.status}`)
    }

    const apiResponse = await response.json()
    if (!apiResponse.success || !apiResponse.data) {
      throw new Error('Invalid response from backend')
    }

    return apiResponse.data
  } catch (error) {
    request.logger.error(
      { error: error.message, reviewId: id },
      'Failed to fetch review data for export'
    )
    throw error
  }
}

/**
 * Generate HTML for export (matching results page exactly)
 */
function generateExportHTML(reviewData, reviewId) {
  const fileName = reviewData.fileName || 'N/A'
  const status = reviewData.status || 'unknown'
  const reviewContent =
    (reviewData.result && reviewData.result.reviewContent) ||
    '<p>No review content available</p>'

  // Read the compiled CSS file path
  const cssPath = path.join(
    __dirname,
    '../../../../public/stylesheets/application.css'
  )

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GOV.UK Content Review Results</title>
  <link rel="stylesheet" href="file://${cssPath}">
  <style>
    body {
      font-family: "GDS Transport", arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #0b0c0c;
      background: white;
      margin: 0;
      padding: 20px;
    }
    
    .govuk-width-container {
      max-width: 960px;
      margin: 0 auto;
    }
    
    /* Review Results Styles */
    .review-output {
      margin-top: 2rem;
    }
    
    .review-output section {
      margin-bottom: 3rem;
      padding: 1.5rem;
      background-color: #f3f2f1;
      border-left: 4px solid #1d70b8;
    }
    
    .review-output h2 {
      margin-top: 0;
      margin-bottom: 1.5rem;
      font-size: 1.5rem;
      font-weight: 700;
    }
    
    /* Summary Section */
    .review-summary {
      background-color: #f3f2f1;
    }
    
    .category-scores {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    
    .score-item {
      padding: 1rem;
      border-radius: 4px;
      border-left: 5px solid;
      background-color: white;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .category-name {
      font-weight: 700;
      font-size: 1rem;
      color: #0b0c0c;
    }
    
    .category-score {
      font-size: 1.5rem;
      font-weight: 700;
    }
    
    .category-note {
      font-size: 0.875rem;
      color: #505a5f;
    }
    
    /* Score colors */
    .score-5 {
      border-left-color: #00703c;
    }
    .score-5 .category-score {
      color: #00703c;
    }
    
    .score-4 {
      border-left-color: #85994b;
    }
    .score-4 .category-score {
      color: #85994b;
    }
    
    .score-3 {
      border-left-color: #ffbf47;
    }
    .score-3 .category-score {
      color: #f47738;
    }
    
    .score-2 {
      border-left-color: #f47738;
    }
    .score-2 .category-score {
      color: #f47738;
    }
    
    .score-1 {
      border-left-color: #d4351c;
    }
    .score-1 .category-score {
      color: #d4351c;
    }
    
    /* Reviewed Content */
    .reviewed-content {
      background-color: white;
      border-left-color: #505a5f;
    }
    
    .content-body {
      font-family: 'GDS Transport', arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      color: #0b0c0c;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .content-body mark {
      padding: 2px 4px;
      border-radius: 3px;
      font-weight: 600;
    }
    
    /* Highlight colors */
    .highlight-critical {
      background-color: #ffe5e5;
      color: #d4351c;
      border-bottom: 2px solid #d4351c;
    }
    
    .highlight-high {
      background-color: #fff4e6;
      color: #f47738;
      border-bottom: 2px solid #f47738;
    }
    
    .highlight-medium {
      background-color: #fff9e6;
      color: #c2910f;
      border-bottom: 2px solid #ffbf47;
    }
    
    .highlight-low {
      background-color: #e6f0ff;
      color: #1d70b8;
      border-bottom: 2px solid #1d70b8;
    }
    
    /* Improvements */
    .example-improvements {
      background-color: #f3f2f1;
    }
    
    .improvement-list {
      list-style: none;
      padding: 0;
      margin: 0;
      counter-reset: improvement-counter;
    }
    
    .improvement-item {
      margin-bottom: 2rem;
      padding: 1rem;
      background-color: white;
      border-radius: 4px;
      border-left: 5px solid #505a5f;
      counter-increment: improvement-counter;
      position: relative;
    }
    
    .improvement-item::before {
      content: counter(improvement-counter) ". ";
      font-weight: 700;
      font-size: 1.2rem;
    }
    
    .severity-critical {
      border-left-color: #d4351c;
    }
    
    .severity-high {
      border-left-color: #f47738;
    }
    
    .severity-medium {
      border-left-color: #ffbf47;
    }
    
    .severity-low {
      border-left-color: #1d70b8;
    }
    
    .issue-title {
      font-weight: 700;
      font-size: 1.1rem;
      display: inline;
    }
    
    .issue-description {
      margin: 0.5rem 0;
      color: #505a5f;
    }
    
    .issue-example {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background-color: #f3f2f1;
      border-radius: 4px;
    }
    
    .before-text {
      color: #d4351c;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    
    .after-text {
      color: #00703c;
      font-weight: 600;
    }
    
    @media print {
      body {
        background: white;
      }
    }
  </style>
</head>
<body>
  <div class="govuk-width-container">
    <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem;">GOV.UK Content Review Results</h1>
    
    <div style="margin-bottom: 2rem; padding: 1rem; background: #f3f2f1; border-left: 4px solid #1d70b8;">
      <p style="margin: 0.25rem 0;"><strong>Document:</strong> ${fileName}</p>
      <p style="margin: 0.25rem 0;"><strong>Review ID:</strong> ${reviewId}</p>
      <p style="margin: 0.25rem 0;"><strong>Status:</strong> ${status}</p>
      ${reviewData.createdAt ? `<p style="margin: 0.25rem 0;"><strong>Created:</strong> ${new Date(reviewData.createdAt).toLocaleString('en-GB')}</p>` : ''}
      ${reviewData.updatedAt ? `<p style="margin: 0.25rem 0;"><strong>Updated:</strong> ${new Date(reviewData.updatedAt).toLocaleString('en-GB')}</p>` : ''}
    </div>
    
    <div class="review-results-container">
      ${reviewContent}
    </div>
    
    <div style="margin-top: 3rem; padding-top: 2rem; border-top: 2px solid #b1b4b6; text-align: center; color: #505a5f; font-size: 0.875rem;">
      <p>Generated by GOV.UK Content Review Tool</p>
      <p>Report ID: ${reviewId}</p>
      <p>Generated on: ${new Date().toLocaleString('en-GB')}</p>
    </div>
  </div>
</body>
</html>
  `
}

export const exportController = {
  /**
   * Export review results as PDF using Puppeteer (exact visual match of results page)
   */
  exportPdf: async (request, h) => {
    const { id } = request.params
    let browser = null

    try {
      const reviewData = await fetchReviewResults(id, request)
      const html = generateExportHTML(reviewData, id)

      // Launch headless browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const page = await browser.newPage()

      // Set content and wait for it to load
      await page.setContent(html, { waitUntil: 'networkidle0' })

      // Generate PDF with proper formatting
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      })

      await browser.close()

      const response = h.response(pdfBuffer)
      response.type('application/pdf')
      response.header(
        'Content-Disposition',
        `attachment; filename="review-results-${id}.pdf"`
      )
      return response
    } catch (error) {
      if (browser) {
        await browser.close()
      }
      request.logger.error(
        { error: error.message, reviewId: id },
        'Failed to generate PDF export'
      )
      return h.response({ error: 'Failed to generate PDF export' }).code(500)
    }
  },

  /**
   * Export review results as Word document using docx library
   */
  exportWord: async (request, h) => {
    const { id } = request.params

    try {
      const reviewData = await fetchReviewResults(id, request)

      // Parse HTML content
      const parsedContent = parseReviewContent(
        reviewData.result && reviewData.result.reviewContent
      )

      // Score level colors (matching GOV.UK design)
      const scoreColors = {
        5: '00703c', // Dark green
        4: '85994b', // Light green
        3: 'f47738', // Orange
        2: 'f47738', // Orange
        1: 'd4351c' // Red
      }

      const severityColors = {
        critical: 'd4351c',
        high: 'f47738',
        medium: 'ffbf47',
        low: '1d70b8'
      }

      // Build document paragraphs
      const children = [
        new Paragraph({
          text: 'GOV.UK Content Review Results',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),

        new Paragraph({
          text: 'Document Information',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Document: ', bold: true }),
            new TextRun(reviewData.fileName || 'N/A')
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Review ID: ', bold: true }),
            new TextRun(reviewData.id || id)
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Status: ', bold: true }),
            new TextRun(reviewData.status || 'N/A')
          ],
          spacing: { after: 400 }
        })
      ]

      // Content Quality Summary
      if (parsedContent.summary && parsedContent.summary.length > 0) {
        children.push(
          new Paragraph({
            text: 'Content Quality Summary',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          })
        )

        parsedContent.summary.forEach((item) => {
          const color = scoreColors[item.scoreLevel] || '505a5f'

          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: item.category, bold: true, size: 24 })
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: item.score, bold: true, color, size: 28 })
              ],
              spacing: { after: 100 }
            })
          )

          if (item.note) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: item.note, color: '505a5f', size: 20 })
                ],
                spacing: { after: 300 }
              })
            )
          }
        })
      }

      // Reviewed Content
      if (parsedContent.reviewedContent) {
        children.push(
          new Paragraph({
            text: 'Your Content (with issues highlighted)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),
          new Paragraph({
            text: parsedContent.reviewedContent,
            spacing: { after: 400 }
          })
        )
      }

      // Top 5 Priority Improvements
      if (parsedContent.improvements && parsedContent.improvements.length > 0) {
        children.push(
          new Paragraph({
            text: 'Top 5 Priority Improvements',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          })
        )

        parsedContent.improvements.forEach((item, index) => {
          const severityColor = severityColors[item.severity] || '505a5f'

          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. ${item.title}`,
                  bold: true,
                  color: severityColor,
                  size: 24
                })
              ],
              spacing: { after: 150 }
            })
          )

          if (item.description) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.description,
                    color: '505a5f',
                    size: 20
                  })
                ],
                spacing: { after: 150 }
              })
            )
          }

          if (item.before) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Current: ',
                    bold: true,
                    color: '505a5f'
                  }),
                  new TextRun({ text: item.before, color: 'd4351c' })
                ],
                spacing: { after: 100 }
              })
            )
          }

          if (item.after) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Suggested: ',
                    bold: true,
                    color: '505a5f'
                  }),
                  new TextRun({ text: item.after, color: '00703c' })
                ],
                spacing: { after: 300 }
              })
            )
          }
        })
      }

      // Footer
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '\n\nGenerated by GOV.UK Content Review Tool',
              italics: true,
              size: 20
            }),
            new TextRun({
              text: `\nReport ID: ${id}`,
              italics: true,
              size: 20
            }),
            new TextRun({
              text: `\nGenerated on: ${new Date().toLocaleString('en-GB')}`,
              italics: true,
              size: 20
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 }
        })
      )

      // Create document
      const doc = new Document({
        sections: [{ children }]
      })

      // Generate buffer
      const buffer = await Packer.toBuffer(doc)

      const response = h.response(buffer)
      response.type(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      response.header(
        'Content-Disposition',
        `attachment; filename="review-results-${id}.docx"`
      )
      return response
    } catch (error) {
      request.logger.error(
        { error: error.message, reviewId: id },
        'Failed to generate Word export'
      )
      return h.response({ error: 'Failed to generate Word export' }).code(500)
    }
  }
}
