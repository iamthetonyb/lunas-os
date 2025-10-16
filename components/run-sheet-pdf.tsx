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
          {assignments.map(assignment => (
            <View key={assignment.id}>
              <Text>Builder: {assignment.jobRequestService.jobRequest.builder.name}</Text>
              <Text>Community: {assignment.jobRequestService.jobRequest.community.name}</Text>
              <Text>Lot: {assignment.jobRequestService.jobRequest.lot}</Text>
              <Text>Service: {assignment.jobRequestService.service.name}</Text>
              <Text>Walk Time: {assignment.jobRequestService.walkTime}</Text>
              <Text>Notes: {assignment.jobRequestService.jobRequest.notes}</Text>
              <Image src={assignment.qrCodeDataUrl} style={{ width: 50, height: 50 }} />
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
