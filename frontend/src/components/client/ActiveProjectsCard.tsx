import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Stack,
  Button,
  Divider,
  LinearProgress,
  alpha,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip, // Add Chip import here
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import { red } from '@mui/material/colors';

// Dummy data for active projects
const dummyProjects = [
  {
    clientName: 'Steven Terry',
    clientAvatar: 'https://i.pravatar.cc/40?img=1',
    project: 'Landing page',
    price: '$800',
    deliveredIn: '1 days 2 hours',
    progress: 90,
  },
  {
    clientName: 'Audrey Jones',
    clientAvatar: 'https://i.pravatar.cc/40?img=2',
    project: 'Development',
    price: '$300',
    deliveredIn: '4 days 8 hours',
    progress: 50,
  },
  {
    clientName: 'Brian Fisher',
    clientAvatar: 'https://i.pravatar.cc/40?img=3',
    project: 'Translator',
    price: '$180',
    deliveredIn: '14 days 2 hours',
    progress: 95,
  },
  {
    clientName: 'Molly Mills',
    clientAvatar: 'https://i.pravatar.cc/40?img=4',
    project: 'Data Analyst',
    price: '$920',
    deliveredIn: '8 days 20 hours',
    progress: 20,
  },
];

// Dummy data for application status (adapting for client's perspective, e.g., proposals reviewed)
const dummyApplicationStatus = [
    {
        title: 'Chinese Translator',
        status: 'Applied',
        date: 'Jan 22',
        details: 'Tech Troopsy (Jurong East, Singapore)',
        tags: ['Remote', 'Contract'],
    },
    {
        title: 'Frontend Developer (Junior Position)',
        status: 'Not selected by employer', // Adapting for Client: e.g., 'Proposal Rejected'
        date: 'Jan 09',
        details: 'PT Nirlaba Digital Indonesia (Kemang, South Jakarta)',
        tags: ['1-3 years exp', 'Freelance'],
    },
    {
        title: 'Website Designer',
        status: 'Interview', // Adapting for Client: e.g., 'Reviewing Proposals'
        date: 'Dec 29',
        details: 'Verganis Studio (Sydney, Australia)',
        tags: ['3 months contract'],
    },
];


interface ActiveProjectsCardProps {
  onAddProject?: () => void;
}

const ActiveProjectsCard: React.FC<ActiveProjectsCardProps> = ({ onAddProject }) => {
  const theme = useTheme();

  return (
    <Card sx={{ borderRadius: 3, p: 2, height: '100%' }}>
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6" component="div" fontWeight="bold">
            Active projects (12)
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddProject}
            sx={{
              bgcolor: theme.palette.primary.main,
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.main, 0.8),
              },
            }}
          >
            Add new project
          </Button>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Client Name</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Delivered in</TableCell>
                <TableCell>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dummyProjects.map((project, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar src={project.clientAvatar} sx={{ width: 28, height: 28 }} />
                      <Box>
                        <Typography variant="body2">{project.clientName}</Typography>
                        <Typography variant="caption" color="text.secondary">View order</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{project.project}</TableCell>
                  <TableCell>{project.price}</TableCell>
                  <TableCell>{project.deliveredIn}</TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={project.progress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            "& .MuiLinearProgress-bar": {
                              bgcolor: theme.palette.primary.main,
                            },
                          }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">{`${project.progress}%`}</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" component="div" fontWeight="bold" mb={2}>
          Application status {/* Adapted for client to show, e.g., proposal review status */}
        </Typography>
        <Stack spacing={2}>
          {dummyApplicationStatus.map((appStatus, index) => (
            <Card key={index} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                                <Box sx={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    bgcolor: appStatus.status === 'Applied' ? theme.palette.success.main :
                                             appStatus.status === 'Interview' ? theme.palette.warning.main :
                                             red[500] // For 'Not selected'
                                }} />
                                <Typography variant="caption" sx={{
                                     color: appStatus.status === 'Applied' ? theme.palette.success.main :
                                             appStatus.status === 'Interview' ? theme.palette.warning.main :
                                             red[500],
                                     fontWeight: 'bold'
                                }}>
                                    {appStatus.status}
                                </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight="bold">{appStatus.title}</Typography>
                            <Typography variant="body2" color="text.secondary" mt={0.5}>{appStatus.details}</Typography>
                            <Stack direction="row" spacing={0.5} mt={1}>
                                {appStatus.tags.map((tag, tagIndex) => (
                                    <Chip
                                        key={tagIndex}
                                        label={tag}
                                        size="small"
                                        sx={{
                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                            color: theme.palette.primary.main,
                                            fontWeight: 'bold'
                                        }}
                                    />
                                ))}
                            </Stack>
                        </Box>
                        <Typography variant="caption" color="text.secondary">Applied on {appStatus.date}</Typography>
                        <IconButton size="small" sx={{ alignSelf: 'flex-start' }}>
                            <MoreVertIcon />
                        </IconButton>
                    </Stack>
                </CardContent>
            </Card>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ActiveProjectsCard;