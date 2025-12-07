import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  alpha,
  useTheme,
  Button,
  Divider,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { green, red, orange } from '@mui/material/colors';

// Dummy Bid Data
const dummyMyBids = [
  {
    bidId: 101,
    jobTitle: 'Website Redesign',
    jobId: 1,
    bidAmount: 1100,
    status: 'Accepted',
    proposal: 'My proposal focuses on a modern, responsive design with a clear UX path. I have extensive experience with Figma and React.',
    bidDate: new Date('2025-11-20T10:00:00Z').getTime(),
  },
  {
    bidId: 102,
    jobTitle: 'Mobile App Development (iOS/Android)',
    jobId: 2,
    bidAmount: 4800,
    status: 'Pending',
    proposal: 'I can deliver a high-quality cross-platform app using React Native, including robust authentication and push notification features. My portfolio includes similar projects.',
    bidDate: new Date('2025-11-22T14:30:00Z').getTime(),
  },
  {
    bidId: 103,
    jobTitle: 'Smart Contract Audit',
    jobId: 3,
    bidAmount: 2400,
    status: 'Rejected',
    proposal: 'Comprehensive audit of your Solidity contracts with detailed report and recommendations. I use industry-standard tools and practices.',
    bidDate: new Date('2025-11-18T09:15:00Z').getTime(),
  },
  {
    bidId: 104,
    jobTitle: 'Content Writing for Blog',
    jobId: 4,
    bidAmount: 280,
    status: 'Pending',
    proposal: 'I specialize in SEO-optimized content for tech blogs. I can deliver engaging and informative articles on blockchain topics.',
    bidDate: new Date('2025-11-25T16:00:00Z').getTime(),
  },
];

interface MyBidsListProps {
  // Add props if needed, e.g., onCancelBid
}

const MyBidsList: React.FC<MyBidsListProps> = () => {
  const theme = useTheme();

  const getStatusChipProps = (status: string) => {
    switch (status) {
      case 'Accepted':
        return {
          icon: <CheckCircleOutlineIcon />,
          color: green[700],
          bgcolor: alpha(green[700], 0.1),
        };
      case 'Pending':
        return {
          icon: <HourglassEmptyIcon />,
          color: orange[700],
          bgcolor: alpha(orange[700], 0.1),
        };
      case 'Rejected':
        return {
          icon: <CancelOutlinedIcon />,
          color: red[700],
          bgcolor: alpha(red[700], 0.1),
        };
      default:
        return {
          icon: null,
          color: theme.palette.text.secondary,
          bgcolor: alpha(theme.palette.text.secondary, 0.1),
        };
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        My Bids
      </Typography>

      <Grid container spacing={3}>
        {dummyMyBids.length > 0 ? (
          dummyMyBids.map((bid) => {
            const chipProps = getStatusChipProps(bid.status);
            return (
              <Grid xs={12} sm={6} md={4} key={bid.bidId}>
                <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="h6" component="div" fontWeight="bold">
                        {bid.jobTitle}
                      </Typography>
                      <Chip
                        label={bid.status}
                        size="small"
                        sx={{
                          bgcolor: chipProps.bgcolor,
                          color: chipProps.color,
                          fontWeight: 'bold',
                        }}
                        icon={chipProps.icon ? React.cloneElement(chipProps.icon, { style: { color: chipProps.color, fontSize: 16 } }) : undefined}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Bid Amount: <Typography component="span" variant="subtitle1" fontWeight="bold" color="primary.main">${bid.bidAmount}</Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Submitted On: {new Date(bid.bidDate).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      Proposal: {bid.proposal.length > 150 ? bid.proposal.substring(0, 150) + '...' : bid.proposal}
                    </Typography>
                  </CardContent>
                  <Box sx={{ p: 2, pt: 0 }}>
                    <Button variant="outlined" fullWidth>
                      View Job Details
                    </Button>
                    {/* Add options like "Withdraw Bid" if status is Pending */}
                  </Box>
                </Card>
              </Grid>
            );
          })
        ) : (
          <Grid xs={12}>
            <Typography variant="h6" color="text.secondary" textAlign="center" sx={{ mt: 5 }}>
              You haven't submitted any bids yet.
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default MyBidsList;