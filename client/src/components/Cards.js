import React from 'react';
import CardItem from './CardItem';
import '../styles/Cards.css';
import { useTranslation } from 'react-i18next';

function Cards() {
  const { t } = useTranslation();

  return (
    <div className='cards'>
      <h1>{t('cards.title')}</h1>
      <div className='cards__container'>
        <div className='cards__wrapper'>
          <ul className='cards__items'>
            <CardItem
              src='images/latin/latin1.jpg'
              text={t('cards.latinChurch')}
              label='Latin Church'
              path='/Latin'
            />
            <CardItem
              src='images/greek/greek1.jpg'
              text={t('cards.greekChurch')}
              label='Greek Orthodox Church'
              path='/Greek'
            />
          </ul>
          <ul className='cards__items'>
            <CardItem
              src='images/mary/mary4.jpg'
              text={t('cards.marysWell')}
              label="Mary's Well"
              path='/MarysWell'
            />
            <CardItem
              src='images/old/old2.jpg'
              text={t('cards.oldCity')}
              label='Old City'
              path='/OldCity'
            />
            <CardItem
              src='images/nazareth/nazareth1.webp'
              text={t('cards.cityOfNazareth')}
              label='City'
              path='/City'
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Cards;
