// Bab 3 picture-answer junction questions. od[0] is the correct diagram; the
// visible answer text comes from the diagram's text description.
export default [
  { id: 'B3-SMP-007', sec: '4.5(c) Membelok ke kanan (Rajah)', pg: 131, topic: 'berhemah', veh: 'bersama', tags: ['senario'],
    q: 'Anda hendak membelok ke kanan di simpang di hadapan. Laluan manakah yang betul?',
    od: [
      { type: 'turn', dir: 'right', variant: 'correct' },
      { type: 'turn', dir: 'right', variant: 'oncoming' },
      { type: 'turn', dir: 'right', variant: 'wrong-lane' },
      { type: 'turn', dir: 'right', variant: 'edge' },
    ],
    e: 'Untuk membelok ke kanan, kekal di lorong sendiri tetapi rapat ke garisan tengah, beri isyarat dan amalkan CITO, kemudian masuk ke lorong kiri jalan yang dituju. Jangan masuk ke lorong arah bertentangan.' },
  { id: 'B3-SMP-008', sec: '4.5(b) Membelok ke kiri (Rajah)', pg: 130, topic: 'berhemah', veh: 'bersama', tags: ['senario'],
    q: 'Anda hendak membelok ke kiri di simpang di hadapan. Laluan manakah yang betul?',
    od: [
      { type: 'turn', dir: 'left', variant: 'correct' },
      { type: 'turn', dir: 'left', variant: 'wide' },
      { type: 'turn', dir: 'left', variant: 'wrong-lane' },
      { type: 'turn', dir: 'left', variant: 'centre' },
    ],
    e: 'Untuk membelok ke kiri, rapatkan kenderaan ke sebelah kiri, beri isyarat, perlahankan dan masuk ke lorong kiri jalan simpang. Jangan membelok lebar ke kanan dahulu.' },
];
