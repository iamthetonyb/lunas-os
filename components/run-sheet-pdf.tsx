import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: '#E4E4E4'
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1
  }
});

export function RunSheetPdf({ assignments }: { assignments: any[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text>Run Sheet</Text>
          {assignments.map(assignment => {
            const jobRequest = assignment?.jobRequestService?.jobRequest;
            const builder = jobRequest?.builder;
            const community = jobRequest?.community;
            const service = assignment?.jobRequestService?.service;
            
            return (
              <View key={assignment.id}>
                <Text>Builder: {builder?.name || 'N/A'}</Text>
                <Text>Community: {community?.name || 'N/A'}</Text>
                <Text>Lot: {jobRequest?.lot || 'N/A'}</Text>
                <Text>Service: {service?.name || 'N/A'}</Text>
                <Text>Walk Time: {assignment?.jobRequestService?.walkTime || 'N/A'}</Text>
                <Text>Notes: {jobRequest?.notes || 'N/A'}</Text>
                {assignment?.qrCodeDataUrl && (
                  <Image src={assignment.qrCodeDataUrl} style={{ width: 50, height: 50 }} />
                )}
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );
}
