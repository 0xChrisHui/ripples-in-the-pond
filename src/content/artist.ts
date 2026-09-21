export type ArtistContent = {
  displayName: string;
  portrait: { src: string; alt: string };
  introduction: string[];
  projectTitle: string;
  projectIntroduction: string[];
};

export const artistContent: ArtistContent = {
  displayName: '叶禹含',
  portrait: {
    src: '/artist/ye-yuhan.jpg',
    alt: '叶禹含在院落中看向一只公鸡',
  },
  introduction: [
    '叶禹含，音乐人、表演者与跨媒介创作者。持续进行音乐创作，也工作于绘画、写作、身体与现场表演之间。',
    '近年的实践游走于音乐、绘画、写作、身体、空间与共同生活之间，关注不同媒介、不同个体以及不同感知方式相遇时，会产生怎样的变化。她持续对梦、神话、身体知觉、日常经验以及人与人之间难以被直接命名的连接感兴趣，并通过绘画通信、现场集体行动、共同创作等方式，让作品在关系和过程中逐渐发生。',
  ],
  projectTitle: 'Ripples in the Pond',
  projectIntroduction: [
    '音乐并不只是一个单向传递的媒介。它更像池塘中的一个流动中心，作为其中的一个触发点，与其他媒介、身体、行动和关系相互碰撞，并继续向外产生波纹。',
    'Ripples in the Pond 在于承认每个人独特的位置，以及各自不同的感知与沟通方式。我们以各自的媒介加入其中，彼此合奏、回应与互动，让影响像波纹一样，在人与人之间发生、扩散，并产生一些尚且未知的变化。',
    '这里也是一个共同生活与彼此相遇的空间。我们邀请每一个来到这里的人，以自己的方式参与其中，并留下属于自己的一点点小小的波纹。',
  ],
};
