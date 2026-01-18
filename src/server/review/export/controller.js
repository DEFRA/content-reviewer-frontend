import PDFDocument from 'pdfkit'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType
} from 'docx'

/**
 * Fetch review results from backend API
 */
async function fetchReviewResults(id, request) {
  const config = request.server.app.config
  const backendUrl = config.get('backendUrl')

  try {
    const response = await fetch(`${backendUrl}/api/review/${id}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch review results: ${response.status}`)
    }

    const apiResponse = await response.json()
    if (!apiResponse.success || !apiResponse.data) {
      throw new Error('Invalid response from backend')
    }

    return transformReviewData(apiResponse.data)
  } catch (error) {
    request.logger.error(
      { error: error.message, reviewId: id },
      'Failed to fetch review data for export'
    )
    throw error
  }
}

/**
 * Transform backend status data to export format
 */
function transformReviewData(statusData) {
  const reviewResult = statusData.result || {}
  const metadata = statusData.metadata || {}
  const aiMetadata = reviewResult.aiMetadata || {}

  return {
    documentName: statusData.filename || 'Unknown Document',
    reviewDate:
      statusData.completedAt ||
      statusData.updatedAt ||
      new Date().toISOString(),
    status: reviewResult.overallStatus || 'completed',
    llmModel: aiMetadata.model || 'Claude 3.7 Sonnet',
    processingTime: calculateProcessingTime(
      statusData.createdAt,
      statusData.completedAt
    ),
    summary: {
      overallScore: calculateOverallScore(reviewResult.overallStatus),
      overallStatus: reviewResult.overallStatus || 'unknown',
      issuesFound: reviewResult.metrics?.totalIssues || 0,
      wordsToAvoid: reviewResult.metrics?.wordsToAvoidCount || 0,
      passiveSentences: reviewResult.metrics?.passiveSentencesCount || 0,
      wordCount: reviewResult.metrics?.wordCount || metadata.wordCount || 0
    },
    sections: {
      overallAssessment:
        reviewResult.sections?.overallAssessment || 'No assessment available',
      contentQuality: reviewResult.sections?.contentQuality || 'No data',
      plainEnglish: reviewResult.sections?.plainEnglishReview || 'No data',
      styleGuide: reviewResult.sections?.styleGuideCompliance || 'No data',
      govspeak: reviewResult.sections?.govspeakReview || 'No data',
      accessibility: reviewResult.sections?.accessibilityReview || 'No data',
      passiveVoice: reviewResult.sections?.passiveVoiceReview || 'No data',
      summaryOfFindings: reviewResult.sections?.summaryOfFindings || 'No data',
      exampleImprovements:
        reviewResult.sections?.exampleImprovements || 'No data'
    },
    fullReviewText:
      reviewResult.reviewText ||
      reviewResult.fullReview ||
      'No review text available'
  }
}

/**
 * Calculate overall score from status
 */
function calculateOverallScore(status) {
  const scoreMap = {
    pass: 95,
    pass_with_recommendations: 80,
    needs_improvement: 60,
    fail: 40,
    unknown: 0
  }
  return scoreMap[status] || 0
}

/**
 * Calculate processing time
 */
function calculateProcessingTime(startTime, endTime) {
  if (!startTime || !endTime) return 'N/A'

  const start = new Date(startTime)
  const end = new Date(endTime)
  const diffMs = end - start
  const diffSec = Math.round(diffMs / 1000)

  if (diffSec < 60) {
    return `${diffSec} seconds`
  } else {
    const minutes = Math.floor(diffSec / 60)
    const seconds = diffSec % 60
    return `${minutes}m ${seconds}s`
  }
}

export const exportController = {
  /**
   * Export review results as PDF
   */
  exportPdf: async (request, h) => {
    const { id } = request.params

    try {
      const results = await fetchReviewResults(id, request)

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 })
      const chunks = []

      // Collect PDF data
      doc.on('data', (chunk) => chunks.push(chunk))

      return new Promise((resolve) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks)
          const response = h.response(pdfBuffer)
          response.type('application/pdf')
          response.header(
            'Content-Disposition',
            `attachment; filename="review-results-${id}.pdf"`
          )
          resolve(response)
        })

        // Header
        doc
          .fontSize(24)
          .text('GOV.UK Content Review Results', { align: 'center' })
        doc.moveDown()

        // Document Information
        doc.fontSize(16).text('Document Information', { underline: true })
        doc.moveDown(0.5)
        doc.fontSize(12)
        doc.text(`Document: ${results.documentName}`)
        doc.text(
          `Review Date: ${new Date(results.reviewDate).toLocaleString('en-GB')}`
        )
        doc.text(`Status: ${results.status}`)
        doc.text(`LLM Model: ${results.llmModel}`)
        doc.text(`Processing Time: ${results.processingTime}`)
        doc.moveDown()

        // Summary
        doc.fontSize(16).text('Summary', { underline: true })
        doc.moveDown(0.5)
        doc.fontSize(12)
        doc.text(`Overall Score: ${results.summary.overallScore}/100`)
        doc.text(`Overall Status: ${results.summary.overallStatus}`)
        doc.text(`Issues Found: ${results.summary.issuesFound}`)
        doc.text(`Word Count: ${results.summary.wordCount}`)
        doc.text(`Words to Avoid: ${results.summary.wordsToAvoid}`)
        doc.text(`Passive Sentences: ${results.summary.passiveSentences}`)
        doc.moveDown()

        // Review Sections
        doc.addPage()
        doc.fontSize(16).text('Detailed Review', { underline: true })
        doc.moveDown(0.5)

        // Overall Assessment
        doc.fontSize(14).text('Overall Assessment', { underline: true })
        doc
          .fontSize(11)
          .text(results.sections.overallAssessment, { align: 'justify' })
        doc.moveDown()

        // Content Quality
        doc.fontSize(14).text('Content Quality', { underline: true })
        doc
          .fontSize(11)
          .text(results.sections.contentQuality, { align: 'justify' })
        doc.moveDown()

        // Plain English Review
        doc.fontSize(14).text('Plain English Review', { underline: true })
        doc
          .fontSize(11)
          .text(results.sections.plainEnglish, { align: 'justify' })
        doc.moveDown()

        // Style Guide Compliance
        doc
          .fontSize(14)
          .text('GOV.UK Style Guide Compliance', { underline: true })
        doc.fontSize(11).text(results.sections.styleGuide, { align: 'justify' })
        doc.moveDown()

        // Add page break if needed
        if (doc.y > 700) {
          doc.addPage()
        }

        // Govspeak Review
        doc
          .fontSize(14)
          .text('Govspeak & Formatting Review', { underline: true })
        doc.fontSize(11).text(results.sections.govspeak, { align: 'justify' })
        doc.moveDown()

        // Accessibility Review
        doc.fontSize(14).text('Accessibility Review', { underline: true })
        doc
          .fontSize(11)
          .text(results.sections.accessibility, { align: 'justify' })
        doc.moveDown()

        // Passive Voice Analysis
        doc.fontSize(14).text('Passive Voice Analysis', { underline: true })
        doc
          .fontSize(11)
          .text(results.sections.passiveVoice, { align: 'justify' })
        doc.moveDown()

        // Example Improvements
        if (doc.y > 700) {
          doc.addPage()
        }
        doc.fontSize(14).text('Example Improvements', { underline: true })
        doc
          .fontSize(11)
          .text(results.sections.exampleImprovements, { align: 'justify' })
        doc.moveDown()

        // Footer
        doc.moveDown(2)
        doc.fontSize(10).fillColor('gray')
        doc.text('Generated by GOV.UK Content Review Tool', { align: 'center' })
        doc.text(`Report ID: ${id}`, { align: 'center' })
        doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, {
          align: 'center'
        })

        doc.end()
      })
    } catch (error) {
      request.logger.error(
        { error: error.message, reviewId: id },
        'Failed to generate PDF export'
      )
      return h.response({ error: 'Failed to generate PDF export' }).code(500)
    }
  },

  /**
   * Export review results as Word document
   */
  exportWord: async (request, h) => {
    const { id } = request.params

    try {
      const results = await fetchReviewResults(id, request)

      // Create document sections
      const sections = [
        {
          children: [
            // Title
            new Paragraph({
              text: 'GOV.UK Content Review Results',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Document Information
            new Paragraph({
              text: 'Document Information',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Document: ', bold: true }),
                new TextRun(results.documentName)
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Review Date: ', bold: true }),
                new TextRun(
                  new Date(results.reviewDate).toLocaleString('en-GB')
                )
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Status: ', bold: true }),
                new TextRun(results.status)
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'LLM Model: ', bold: true }),
                new TextRun(results.llmModel)
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Processing Time: ', bold: true }),
                new TextRun(results.processingTime)
              ],
              spacing: { after: 200 }
            }),

            // Summary
            new Paragraph({
              text: 'Summary',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Overall Score: ', bold: true }),
                new TextRun(`${results.summary.overallScore}/100`)
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Overall Status: ', bold: true }),
                new TextRun(results.summary.overallStatus)
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Issues Found: ', bold: true }),
                new TextRun(String(results.summary.issuesFound))
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Word Count: ', bold: true }),
                new TextRun(String(results.summary.wordCount))
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Words to Avoid: ', bold: true }),
                new TextRun(String(results.summary.wordsToAvoid))
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Passive Sentences: ', bold: true }),
                new TextRun(String(results.summary.passiveSentences))
              ],
              spacing: { after: 200 }
            }),

            // Review Sections
            new Paragraph({
              text: 'Detailed Review',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),

            // Overall Assessment
            new Paragraph({
              text: 'Overall Assessment',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: results.sections.overallAssessment,
              spacing: { after: 200 }
            }),

            // Content Quality
            new Paragraph({
              text: 'Content Quality',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: results.sections.contentQuality,
              spacing: { after: 200 }
            }),

            // Plain English Review
            new Paragraph({
              text: 'Plain English Review',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: results.sections.plainEnglish,
              spacing: { after: 200 }
            }),

            // Style Guide Compliance
            new Paragraph({
              text: 'GOV.UK Style Guide Compliance',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: results.sections.styleGuide,
              spacing: { after: 200 }
            }),

            // Govspeak Review
            new Paragraph({
              text: 'Govspeak & Formatting Review',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: results.sections.govspeak,
              spacing: { after: 200 }
            }),

            // Accessibility Review
            new Paragraph({
              text: 'Accessibility Review',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: results.sections.accessibility,
              spacing: { after: 200 }
            }),

            // Passive Voice Analysis
            new Paragraph({
              text: 'Passive Voice Analysis',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: results.sections.passiveVoice,
              spacing: { after: 200 }
            }),

            // Example Improvements
            new Paragraph({
              text: 'Example Improvements',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: results.sections.exampleImprovements,
              spacing: { after: 400 }
            }),

            // Footer
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
          ]
        }
      ]

      // Create document
      const doc = new Document({ sections })

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
