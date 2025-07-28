/**
 * Templates page for managing reusable context templates
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  Button,
  Tile,
  Tag,
  Search,
  SkeletonPlaceholder,
  SkeletonText,
  Modal,
  TextInput,
  TextArea,
  FormGroup,
  Heading,
} from '@carbon/react';
import { Add, Template, Copy, Edit, TrashCan } from '@carbon/react/icons';

interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  usageCount: number;
  tags: string[];
  content: string;
  createdAt: string;
}

const templateCategories = [
  'Development',
  'Analysis',
  'Planning',
  'Research',
  'Documentation',
  'BMad Workflow',
];

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Development',
    content: '',
    tags: '',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, selectedCategory]);

  const fetchTemplates = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const mockTemplates: Template[] = [
        {
          id: 'tpl_1',
          title: 'React Component Analysis',
          description: 'Template for analyzing React components with performance considerations',
          category: 'Development',
          usageCount: 24,
          tags: ['react', 'analysis', 'performance'],
          content: 'Analyze the following React component for:\n- Performance optimizations\n- Code quality\n- Best practices\n- Accessibility',
          createdAt: '2024-01-15',
        },
        {
          id: 'tpl_2',
          title: 'User Research Summary',
          description: 'Template for summarizing user research findings',
          category: 'Research',
          usageCount: 18,
          tags: ['research', 'ux', 'summary'],
          content: 'Summarize the user research findings including:\n- Key insights\n- User pain points\n- Opportunities\n- Recommendations',
          createdAt: '2024-01-10',
        },
        {
          id: 'tpl_3',
          title: 'API Documentation Review',
          description: 'Template for reviewing API documentation',
          category: 'Documentation',
          usageCount: 12,
          tags: ['api', 'documentation', 'review'],
          content: 'Review the API documentation for:\n- Completeness\n- Clarity\n- Examples\n- Error handling',
          createdAt: '2024-01-08',
        },
        {
          id: 'tpl_4',
          title: 'BMad Agent Workflow',
          description: 'Template for BMad framework agent interactions',
          category: 'BMad Workflow',
          usageCount: 8,
          tags: ['bmad', 'workflow', 'agents'],
          content: 'BMad agent workflow for:\n- Problem analysis\n- Solution design\n- Implementation planning\n- Quality assurance',
          createdAt: '2024-01-05',
        },
      ];
      setTemplates(mockTemplates);
      setLoading(false);
    }, 800);
  };

  const filterTemplates = () => {
    let filtered = templates;

    if (searchTerm) {
      filtered = filtered.filter(
        (template) =>
          template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((template) => template.category === selectedCategory);
    }

    setFilteredTemplates(filtered);
  };

  const handleCreateTemplate = () => {
    setFormData({
      title: '',
      description: '',
      category: 'Development',
      content: '',
      tags: '',
    });
    setCreateModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    // API call to save template
    console.log('Saving template:', formData);
    setCreateModalOpen(false);
    fetchTemplates();
  };

  const handleUseTemplate = (template: Template) => {
    // Navigate to create context with template
    console.log('Using template:', template.id);
  };

  const handleCopyTemplate = (template: Template) => {
    navigator.clipboard.writeText(template.content);
    // Show success notification
  };

  if (loading) {
    return (
      <div className="page-container">
        <Heading marginBottom={7}>Templates</Heading>
        <Grid>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Column key={i} lg={4} md={4} sm={4}>
              <Tile style={{ marginBottom: '1rem' }}>
                <SkeletonPlaceholder style={{ height: '1.5rem', width: '70%', marginBottom: '1rem' }} />
                <SkeletonText paragraph={false} lineCount={2} />
                <div style={{ marginTop: '1rem' }}>
                  <SkeletonPlaceholder style={{ height: '2rem', width: '100px' }} />
                </div>
              </Tile>
            </Column>
          ))}
        </Grid>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Heading marginBottom={0}>Templates</Heading>
        <Button renderIcon={Add} kind="primary" onClick={handleCreateTemplate}>
          Create Template
        </Button>
      </div>

      {/* Search and Filter */}
      <div style={{ marginBottom: '2rem' }}>
        <Grid>
          <Column lg={8} md={6} sm={4}>
            <Search
              size="lg"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />
          </Column>
        </Grid>
      </div>

      {/* Category Filter */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button
          size="sm"
          kind={selectedCategory === null ? 'primary' : 'tertiary'}
          onClick={() => setSelectedCategory(null)}
        >
          All Categories
        </Button>
        {templateCategories.map((category) => (
          <Button
            key={category}
            size="sm"
            kind={selectedCategory === category ? 'primary' : 'tertiary'}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <Grid>
        {filteredTemplates.map((template) => (
          <Column key={template.id} lg={4} md={4} sm={4}>
            <Tile className="context-card" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <Template size={20} style={{ marginRight: '0.5rem', color: 'var(--ai-text)' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{template.title}</h4>
              </div>
              
              <p style={{ 
                fontSize: '0.875rem', 
                color: 'var(--cds-text-secondary)', 
                marginBottom: '1rem',
                flex: 1,
                lineHeight: '1.4'
              }}>
                {template.description}
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <Tag type="outline" size="sm">{template.category}</Tag>
                  {template.tags.slice(0, 2).map((tag) => (
                    <Tag key={tag} type="gray" size="sm">{tag}</Tag>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
                  Used {template.usageCount} times
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button size="sm" kind="primary" onClick={() => handleUseTemplate(template)}>
                  Use Template
                </Button>
                <Button 
                  size="sm" 
                  kind="ghost" 
                  renderIcon={Copy}
                  onClick={() => handleCopyTemplate(template)}
                  hasIconOnly
                  iconDescription="Copy"
                />
                <Button 
                  size="sm" 
                  kind="ghost" 
                  renderIcon={Edit}
                  onClick={() => console.log('Edit template', template.id)}
                  hasIconOnly
                  iconDescription="Edit"
                />
              </div>
            </Tile>
          </Column>
        ))}
      </Grid>

      {filteredTemplates.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cds-text-secondary)' }}>
          <Template size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No templates found</h3>
          <p>Try adjusting your search or create a new template.</p>
        </div>
      )}

      {/* Create Template Modal */}
      <Modal
        open={createModalOpen}
        onRequestClose={() => setCreateModalOpen(false)}
        modalHeading="Create New Template"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSaveTemplate}
        size="lg"
      >
        <FormGroup legendText="">
          <TextInput
            id="template-title"
            labelText="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter template title"
          />
          <TextInput
            id="template-description"
            labelText="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the template"
          />
          <TextArea
            id="template-content"
            labelText="Template Content"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Enter the template content with placeholders"
            rows={8}
          />
          <TextInput
            id="template-tags"
            labelText="Tags (comma-separated)"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="tag1, tag2, tag3"
          />
        </FormGroup>
      </Modal>
    </div>
  );
};