import type { FrogPerch } from '../../domain/home/perch';

/** The reference sheet's three views and six expressive poses, at one body scale. */
export const FROG_POSES = ['welcome', 'front', 'profile', 'back', 'mushroom', 'box', 'sleep', 'walk', 'placard'] as const;
export type FrogPose = (typeof FROG_POSES)[number];

export const FROG_POSE_LABELS: Readonly<Record<FrogPose, string>> = {
  welcome: '张开双手，抬头', front: '正面站立', profile: '侧身看向远处', back: '背过身坐着',
  mushroom: '抱着小蘑菇', box: '趴在纸箱边', sleep: '蜷起来睡觉', walk: '迈步出发', placard: '捧着明信片',
};

export const PERCH_POSE: Readonly<Record<FrogPerch, FrogPose>> = {
  armchair: 'mushroom', 'fireplace-rug': 'welcome', curio: 'profile', bookshelf: 'placard', suitcase: 'box', footstool: 'sleep',
};

export function nextFrogPose(pose: FrogPose): FrogPose {
  return FROG_POSES[(FROG_POSES.indexOf(pose) + 1) % FROG_POSES.length]!;
}
