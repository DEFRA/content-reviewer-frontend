/**
 * Data service for review results
 * Centralizes the mock data and will be replaced with S3 fetch in production
 */

const dummyDataSets = {
  1001: {
    documentName: 'GOV.UK_Service_Standards.pdf',
    summary: {
      overallScore: 85,
      readabilityScore: 'Good',
      complianceScore: 'Excellent',
      issuesFound: 3,
      wordCount: 2450,
      averageSentenceLength: 18,
      complexWords: 145
    },
    findings: [
      {
        category: 'Readability',
        severity: 'Medium',
        description:
          'Some sentences exceed the recommended 25-word limit for GOV.UK content.',
        location: 'Page 2, Paragraph 3 and Page 5, Paragraph 1',
        suggestion:
          'Break down complex sentences into shorter, clearer statements. Use bullet points where appropriate to improve scannability.',
        aiConfidence: 0.92
      },
      {
        category: 'Formatting',
        severity: 'Low',
        description:
          'Inconsistent heading hierarchy detected. H3 used before H2 in section 4.',
        location: 'Page 4, Section 4',
        suggestion:
          'Use consistent heading hierarchy (H1, H2, H3) throughout the document. Ensure headings follow logical progression.',
        aiConfidence: 0.88
      },
      {
        category: 'GOV.UK Standards',
        severity: 'Medium',
        description:
          'Technical jargon detected that may not be accessible to all users.',
        location: 'Page 1, Introduction and Page 3, Technical Requirements',
        suggestion:
          'Replace technical jargon with plain English alternatives. Add a glossary for unavoidable technical terms.',
        aiConfidence: 0.95
      }
    ],
    recommendations: [
      'Use shorter sentences (average 25 words or less) to improve readability',
      'Apply consistent formatting and heading hierarchy throughout the document',
      'Review content against GOV.UK style guide and content design principles',
      'Consider adding more subheadings to break up long sections'
    ]
  },
  1005: {
    documentName: 'Policy_Update_Jan2026.pdf',
    summary: {
      overallScore: 92,
      readabilityScore: 'Excellent',
      complianceScore: 'Good',
      issuesFound: 2,
      wordCount: 1850,
      averageSentenceLength: 16,
      complexWords: 98
    },
    findings: [
      {
        category: 'Accessibility',
        severity: 'High',
        description:
          'Images lack descriptive alt text which is required for screen readers.',
        location: 'Page 3, Figures 1-3',
        suggestion:
          'Add comprehensive alt text describing the content and purpose of each image. For complex diagrams, consider providing a text alternative.',
        aiConfidence: 0.97
      },
      {
        category: 'Language',
        severity: 'Low',
        description:
          'Passive voice used in several sections, making content less direct.',
        location: 'Page 2, Section 1.2 and Page 4, Section 2.1',
        suggestion:
          'Convert passive constructions to active voice. For example, change "The policy was implemented by the team" to "The team implemented the policy".',
        aiConfidence: 0.85
      }
    ],
    recommendations: [
      'Add alt text to all images and diagrams',
      'Use active voice throughout to make content more direct and engaging',
      'Excellent use of plain English - continue this approach',
      'Well-structured document with clear headings and logical flow'
    ]
  },
  default: {
    documentName: 'Uploaded Document',
    summary: {
      overallScore: 78,
      readabilityScore: 'Fair',
      complianceScore: 'Good',
      issuesFound: 4,
      wordCount: 1200,
      averageSentenceLength: 22,
      complexWords: 89
    },
    findings: [
      {
        category: 'Readability',
        severity: 'Medium',
        description:
          'Content contains long paragraphs that may be difficult for users to scan.',
        location: 'Throughout document',
        suggestion:
          'Break content into shorter paragraphs (3-5 sentences). Use bullet points and numbered lists to improve scannability.',
        aiConfidence: 0.89
      },
      {
        category: 'Plain English',
        severity: 'Medium',
        description:
          'Several instances of complex vocabulary that could be simplified.',
        location: 'Section 2 and Section 3',
        suggestion:
          'Replace complex words with simpler alternatives. For example, use "use" instead of "utilize", "help" instead of "facilitate".',
        aiConfidence: 0.91
      },
      {
        category: 'Structure',
        severity: 'Low',
        description:
          'Document would benefit from more descriptive subheadings.',
        location: 'Sections 1-4',
        suggestion:
          'Add descriptive subheadings to help users navigate and understand the content structure.',
        aiConfidence: 0.86
      },
      {
        category: 'Call to Action',
        severity: 'Low',
        description: 'Missing clear call-to-action or next steps for users.',
        location: 'End of document',
        suggestion:
          'Add a clear section explaining what users should do next or how to get more information.',
        aiConfidence: 0.84
      }
    ],
    recommendations: [
      'Break long paragraphs into shorter sections',
      'Simplify complex vocabulary and technical terms',
      'Add more descriptive subheadings throughout',
      'Include clear calls-to-action and next steps',
      'Consider adding a summary section at the beginning',
      'Review against GOV.UK content design principles'
    ]
  }
}

/**
 * Get review results for a given ID
 * @param {string} id - Review ID
 * @returns {Object} Review results including workflow steps for debugging
 */
export function getReviewResults(id) {
  const dummyData = dummyDataSets[id] || dummyDataSets['default']

  return {
    id,
    documentName: dummyData.documentName,
    reviewDate: new Date().toISOString(),
    status: 'Completed',
    s3Location: `s3://dev-service-optimisation-c63f2/review-results/review-${id}.json`,
    workflowSteps: [
      {
        step: 'Upload to S3',
        status: 'Completed',
        timestamp: new Date(Date.now() - 120000)
      },
      {
        step: 'Message to SQS Queue',
        status: 'Completed',
        timestamp: new Date(Date.now() - 115000)
      },
      {
        step: 'SQS Orchestrator Processing',
        status: 'Completed',
        timestamp: new Date(Date.now() - 110000)
      },
      {
        step: 'LLM Content Review',
        status: 'Completed',
        timestamp: new Date(Date.now() - 60000)
      },
      {
        step: 'Save Results to S3',
        status: 'Completed',
        timestamp: new Date(Date.now() - 5000)
      }
    ],
    summary: dummyData.summary,
    findings: dummyData.findings,
    recommendations: dummyData.recommendations,
    llmModel: 'AWS Bedrock - Claude 3.5 Sonnet',
    processingTime: '45 seconds'
  }
}
