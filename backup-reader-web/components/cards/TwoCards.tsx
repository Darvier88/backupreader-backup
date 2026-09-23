import React, { FC } from "react";
import Image from 'next/image';
import styles from './TwoCards.module.css';

interface TwoCardProps {
    image: string;
    video: string;
    title: string;
    text: string;
    alt: string;
    width: number;
    height: number;
    orientation: "left" | "right";
}

export const TwoCards: FC<TwoCardProps> = ({ image, video, title, text, orientation, width, height, alt }) => {

    const containerClass = orientation === "left" ? styles.leftContainer : styles.rightContainer;

    const renderVideo = () => (
        <video width={width ? width.toString() : "360"} height={height ? height.toString() : "640"} controls>
            <source src={video} type="video/mp4" />
            Your browser does not support the video tag.
        </video>
    );

    return (
        <div className={`${styles.twoCardsContainer} ${containerClass}`}>
            {video ? (
                <div className={styles.videoContainer}>
                    {renderVideo()}
                </div>
            ) : (
                <div className={styles.imageContainer}>
                    <Image
                        priority
                        src={image}
                        width={ width ? width : 300}
                        height={ height ? height : 300}
                        alt={ alt ? alt : "" }
                    />
                </div>
            )}
            <div className={styles.contentContainer}>
                <h3>{title}</h3>
                <p>{text}</p>
            </div>
        </div>
    );
};
